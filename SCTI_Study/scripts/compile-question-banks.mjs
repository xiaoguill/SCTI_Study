import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAlgorithmProfile, validateBank } from "./validate-question-banks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const writeJson = (file, value) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const ALGORITHM_PROFILE = "three-layer.v2.0.0";

const SOURCES = [
  {
    version: "high_school", prefix: "H", file: "校园人设测试_高中版V5_完整题目与算法.md",
    labels: ["学习投入度", "社交活跃度", "自律执行力", "兴趣开放性"],
    title: "高中版校园人设测试", revision: "来源核心题表中的 H3、H14 已标注“修正”，编译时采用修正后的题目。"
  },
  {
    version: "graduate", prefix: "G", file: "校园人设测试_硕博版V5_完整题目与算法.md",
    labels: ["学术投入度", "社交活跃度", "自律执行力", "探索开放性"],
    title: "硕博版校园人设测试", revision: "来源核心题表中未标注需替换的核心题；保留原始三层算法定义。"
  }
];

function tableRows(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error(`找不到章节：${heading}`);
  const rows = [];
  let started = false;
  for (const line of markdown.slice(start).split("\n")) {
    if (/^\|/.test(line)) {
      started = true;
      if (!/^\|[-| ]+\|$/.test(line)) rows.push(line.split("|").slice(1, -1).map((cell) => cell.trim()));
    } else if (started) break;
  }
  return rows;
}

function stars(value) {
  const count = (value.match(/★/g) || []).length;
  if (count < 1 || count > 5) throw new Error(`非法四维度星级：${value}`);
  return count;
}

function parseTags(markdown, source) {
  const tagRows = tableRows(markdown, "### 1.1 完整标签列表").filter((row) => new RegExp(`^${source.prefix}\\d+$`).test(row[0]));
  const dimensionRows = tableRows(markdown, "### 2.5 四维度与人设的对应关系").filter((row) => new RegExp(`^${source.prefix}\\d+\\s`).test(row[0]));
  const dimensions = new Map(dimensionRows.map((row) => [row[0].match(new RegExp(`^(${source.prefix}\\d+)`))[1], row.slice(1).map(stars)]));
  return tagRows.map((row) => {
    const id = row[0];
    const name = row[1].replaceAll("**", "");
    const short_desc = row[2].replace(/^"|"$/g, "");
    const portrait = row[3];
    return {
      id, prefix: source.prefix, name, short_desc, portrait,
      keywords: [`#${name}`, `#${source.version === "graduate" ? "研究生" : "高中"}`],
      dimensions: dimensions.get(id),
      full_desc: {
        paragraph_1: `${name}的你，${short_desc}。`,
        paragraph_2: `你的核心画像是：${portrait}。这不是标准答案，只是你在校园里的独特打开方式。`,
        paragraph_3: `把自己的节奏走稳，你会把这份特质变成真正的优势。`
      },
      share_copy: `我测出是「${name}」：${short_desc}。来看看你的校园人设！`,
      core_questions: []
    };
  });
}

function parseQuestionSection(markdown, qid) {
  const pattern = new RegExp(`^### Q${qid}\\.\\s*(.*?)(?=^### Q${qid + 1}\\.|^## 四、|(?![\\s\\S]))`, "ms");
  const match = markdown.match(pattern);
  if (!match) throw new Error(`找不到 Q${qid}`);
  return match[1];
}

function parseScores(text, prefix) {
  const scores = {};
  const matcher = new RegExp(`\\b(${prefix}\\d+)\\s+[^()·\\n]*?\\s+\\(([012])\\)`, "g");
  for (const hit of text.matchAll(matcher)) scores[hit[1]] = Number(hit[2]);
  return scores;
}

function parseQuestions(markdown, source, tags) {
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  return Array.from({ length: 20 }, (_, offset) => {
    const id = offset + 1;
    const section = parseQuestionSection(markdown, id);
    const title = section.split("\n")[0].replace(/^[🔴🟢🟡\s【】节奏破坏题：]+/u, "").trim();
    const optionMatches = [...section.matchAll(/^- \*\*([A-P])\.\*\*\s*(.*?)\n(?:  - →\s*(.*?))?(?=\n- \*\*[A-P]\.\*\*|\n>|\n---|$)/gms)];
    const eggOnly = /彩蛋：/.test(section);
    const options = optionMatches.map((match, index) => {
      const mapping = match[3] || "";
      const scores = eggOnly ? {} : parseScores(mapping, source.prefix);
      const weighted = Object.entries(scores).filter(([, score]) => score > 0);
      const dimensions = weighted.length
        ? [0, 1, 2, 3].map((dimension) => Number((weighted.reduce((sum, [tagId, score]) => sum + tagById.get(tagId).dimensions[dimension] * score, 0) / weighted.reduce((sum, [, score]) => sum + score, 0)).toFixed(2)))
        : [3, 3, 3, 3];
      const egg = mapping.match(/彩蛋：[“"]([^”"]+)[”"]/);
      return { id: match[1], index, text: match[2].replace(/\s+/g, " ").trim(), scores, dimensions, ...(egg ? { easter_egg: egg[1] } : {}) };
    });
    const expected = id === 20 ? 16 : 4;
    if (options.length !== expected) throw new Error(`${source.version} Q${id} 解析到 ${options.length} 个选项，期望 ${expected}`);
    const resultEffect = id === 20 ? "self_perception_only" : (eggOnly ? "egg_only" : "scored");
    return { id, text: title, type: id === 20 ? "self_portrait" : "single_choice", result_effect: resultEffect, options };
  });
}

function parseCoreQuestions(markdown, source, tags) {
  const rows = tableRows(markdown, "## 五、核心定选题速查表").filter((row) => new RegExp(`^${source.prefix}\\d+\\s`).test(row[0]));
  const revisions = [];
  for (const row of rows) {
    const id = row[0].match(new RegExp(`^(${source.prefix}\\d+)`))[1];
    const core = [];
    row.slice(1).forEach((cell, cellIndex) => {
      let selected = cell;
      if (/修正：/.test(selected)) {
        const before = selected.slice(0, selected.indexOf("修正："));
        const after = selected.slice(selected.indexOf("修正：") + 3);
        const from = [...before.matchAll(/Q(\d+)→([A-P])/g)].map((hit) => ({ qid: Number(hit[1]), option_id: hit[2] }));
        const to = [...after.matchAll(/Q(\d+)→([A-P])/g)].map((hit) => ({ qid: Number(hit[1]), option_id: hit[2] }));
        revisions.push({ bank: source.version, tag_id: id, source_cell: cellIndex + 1, before: from, after: to, reason: "原始核心题表明确标注修正；采用修正后的题目以消除错误信号。" });
        selected = after;
      }
      for (const hit of selected.matchAll(/Q(\d+)→([A-P])/g)) core.push({ qid: Number(hit[1]), option_id: hit[2], answer_index: hit[2].charCodeAt(0) - 65 });
    });
    const tag = tags.find((item) => item.id === id);
    tag.core_questions = core;
  }
  return revisions;
}

function enforceUnambiguousCores(tags, source) {
  const revisions = [];
  for (const tag of tags) {
    if (tag.core_questions.some((core) => core.qid === 20)) continue;
    const before = tag.core_questions.map((core) => ({ ...core }));
    const numericId = Number(tag.id.slice(source.prefix.length));
    const option_id = String.fromCharCode(64 + numericId);
    tag.core_questions[tag.core_questions.length - 1] = { qid: 20, option_id, answer_index: option_id.charCodeAt(0) - 65 };
    revisions.push({
      bank: source.version, tag_id: tag.id, before, after: tag.core_questions.map((core) => ({ ...core })),
      reason: "该标签没有 Q20 的唯一自我写照信号，可能与其他标签在同一完整答题中同时精确命中；用对应标签的 Q20 选项替换最后一个核心题以保证精确匹配互斥。"
    });
  }
  return revisions;
}

function eggs(questions) {
  return questions.filter((question) => question.result_effect === "egg_only").map((question) => ({
    source_qid: question.id,
    title: `Q${question.id} 趣味彩蛋`,
    option_mapping: question.options.map((option) => ({ option_id: option.id, label: option.easter_egg, desc: option.easter_egg }))
  }));
}

function buildFromMarkdown(source) {
  const markdown = read(source.file);
  const tags = parseTags(markdown, source);
  if (tags.length !== 16 || tags.some((tag) => !tag.dimensions)) throw new Error(`${source.version} 标签解析失败`);
  const questions = parseQuestions(markdown, source, tags);
  const revisions = [...parseCoreQuestions(markdown, source, tags), ...enforceUnambiguousCores(tags, source)];
  return {
    bank: {
      "$schema": "../../schemas/question-bank.schema.json", version: source.version, bank_version: "5.0.0", status: "active",
      algorithm_profile: ALGORITHM_PROFILE,
      source: { document: source.file, extraction: "v5.0.0 markdown compiler", weight_completion: "权重完全按题目选项映射提取；无权重的 egg_only 题分数为空，四维度为中性 [3,3,3,3]。" },
      dimension_config: { labels: source.labels }, tags, questions, easter_eggs: eggs(questions)
    },
    revisions
  };
}

function buildUniversity() {
  const bank = JSON.parse(read("data/banks/university.v5.0.0.json"));
  bank.$schema = "../../schemas/question-bank.schema.json";
  bank.bank_version = "5.0.0";
  bank.algorithm_profile = ALGORITHM_PROFILE;
  bank.source = { document: "校园人设测试_大学版V5_完整题目与算法.md", extraction: "迁移现有 V5.0.1 私有题库；原文完整权重附录已在既有构建产物中固化。" };
  bank.dimension_config = { labels: Array.isArray(bank.dimension_config?.labels) ? bank.dimension_config.labels : Object.values(bank.dimension_config).filter((value) => typeof value === "string") };
  for (const tag of bank.tags) {
    tag.portrait ??= tag.short_desc;
    tag.share_copy ??= `我测出是「${tag.name}」：${tag.short_desc}。来看看你的校园人设！`;
    tag.core_questions = tag.core_questions.map((core) => {
      const option_id = core.option_id ?? String.fromCharCode(65 + core.answer_index);
      return { qid: core.qid, option_id, answer_index: core.answer_index ?? option_id.charCodeAt(0) - 65 };
    });
  }
  for (const question of bank.questions) {
    question.options.forEach((option, index) => { option.id ??= String.fromCharCode(65 + index); option.index = index; });
  }
  bank.easter_eggs = bank.easter_eggs.map((egg) => ({
    ...egg,
    option_mapping: egg.option_mapping.map((item) => ({ ...item, option_id: item.option_id ?? String.fromCharCode(65 + item.answer_index) }))
  }));
  return { bank, revisions: [] };
}

export function compileQuestionBanks({ write = true } = {}) {
  const generated = [buildUniversity(), ...SOURCES.map(buildFromMarkdown)];
  const banks = generated.map((item) => item.bank);
  const profileIds = [...new Set(banks.map((bank) => bank.algorithm_profile))];
  const profiles = Object.fromEntries(profileIds.map((id) => {
    const profile = JSON.parse(read(`data/algorithms/${id}.json`));
    validateAlgorithmProfile(profile);
    return [id, profile];
  }));

  for (const bank of banks) {
    if (!profiles[bank.algorithm_profile]) throw new Error(`[${bank.version}] referenced algorithm profile is missing`);
    validateBank(bank, bank.tags[0]?.prefix);
  }

  const revisionLog = {
    version: "5.0.0", policy: "完整核心签名必须唯一；原文明确写出的修正优先于同一单元格中被替换的旧引用。",
    source_gaps: ["高中版与硕博版未提供大学版附录 A 式独立权重表；本编译器直接提取题目选项中的 0/1/2 映射，不把未声明信号补造成权重。", "高中版与硕博版未提供逐标签结果页与分享文案；按标签表的一句话描述和核心画像补齐，并通过统一字数校验。"],
    revisions: generated.flatMap((item) => item.revisions)
  };

  if (write) {
    for (const bank of banks) writeJson(`data/banks/${bank.version}.v5.0.0.json`, bank);
    writeJson("data/banks/revision-log.v5.0.0.json", revisionLog);
  }
  return { banks, profiles, revisionLog };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { banks } = compileQuestionBanks();
  console.log(`Compiled ${banks.map((bank) => `${bank.version}:${bank.questions.length}Q/${bank.tags.length}T`).join(", ")}`);
}
