import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BANKS = [
  ["university", "U"], ["high_school", "H"], ["graduate", "G"]
];
const fail = (bank, message) => { throw new Error(`[${bank.version}] ${message}`); };
const exactSignature = (core) => core.map(({ qid, option_id }) => `${qid}:${option_id}`).sort().join("|");

export function validateBank(bank, expectedPrefix) {
  if (!bank || typeof bank !== "object") throw new Error("bank must be an object");
  if (bank.bank_version !== "5.0.0") fail(bank, "bank_version must be 5.0.0");
  if (!Array.isArray(bank.dimension_config?.labels) || bank.dimension_config.labels.length !== 4) fail(bank, "requires four dimension labels");
  if (!Array.isArray(bank.tags) || bank.tags.length !== 16) fail(bank, "requires exactly 16 tags");
  if (!Array.isArray(bank.questions) || bank.questions.length !== 20) fail(bank, "requires exactly 20 questions");
  const tagIds = new Set();
  for (const tag of bank.tags) {
    if (!new RegExp(`^${expectedPrefix}(?:[1-9]|1[0-6])$`).test(tag.id)) fail(bank, `tag ${tag.id} has invalid ${expectedPrefix} prefix`);
    if (tagIds.has(tag.id)) fail(bank, `duplicate tag ${tag.id}`);
    tagIds.add(tag.id);
    if (!Array.isArray(tag.dimensions) || tag.dimensions.length !== 4 || tag.dimensions.some((value) => !Number.isInteger(value) || value < 1 || value > 5)) fail(bank, `tag ${tag.id} has invalid dimensions`);
    if (!Array.isArray(tag.core_questions) || tag.core_questions.length < 2 || tag.core_questions.length > 3) fail(bank, `tag ${tag.id} needs 2-3 core questions`);
    if (!tag.full_desc || !["paragraph_1", "paragraph_2", "paragraph_3"].every((field) => typeof tag.full_desc[field] === "string" && tag.full_desc[field].length >= 16 && tag.full_desc[field].length <= 240)) fail(bank, `tag ${tag.id} result copy must be 16-240 chars per paragraph`);
    if (typeof tag.share_copy !== "string" || tag.share_copy.length < 16 || tag.share_copy.length > 100) fail(bank, `tag ${tag.id} share copy must be 16-100 chars`);
  }
  const questionById = new Map(bank.questions.map((question) => [question.id, question]));
  for (const question of bank.questions) {
    if (!Number.isInteger(question.id) || question.id < 1 || question.id > 20) fail(bank, `invalid question id ${question.id}`);
    const expectedOptions = question.id === 20 ? 16 : 4;
    if (!Array.isArray(question.options) || question.options.length !== expectedOptions) fail(bank, `Q${question.id} requires ${expectedOptions} options`);
    for (const option of question.options) {
      if (!/^[A-P]$/.test(option.id)) fail(bank, `Q${question.id} has invalid option id ${option.id}`);
      if (!Array.isArray(option.dimensions) || option.dimensions.length !== 4 || option.dimensions.some((value) => typeof value !== "number" || value < 1 || value > 5)) fail(bank, `Q${question.id}${option.id} has invalid dimensions`);
      for (const [tagId, score] of Object.entries(option.scores || {})) {
        if (!tagIds.has(tagId) || !Number.isInteger(score) || score < 0 || score > 2) fail(bank, `Q${question.id}${option.id} has invalid weight for ${tagId}`);
      }
      if (question.result_effect === "egg_only" && typeof option.easter_egg !== "string") fail(bank, `Q${question.id}${option.id} is egg_only but lacks easter_egg`);
    }
  }
  const coreByTag = new Map();
  for (const tag of bank.tags) {
    for (const core of tag.core_questions) {
      const question = questionById.get(core.qid);
      if (!question?.options.some((option) => option.id === core.option_id)) fail(bank, `tag ${tag.id} references invalid core Q${core.qid}${core.option_id}`);
    }
    const signature = exactSignature(tag.core_questions);
    if (coreByTag.has(signature)) fail(bank, `core collision: ${tag.id} and ${coreByTag.get(signature).id} share ${signature}`);
    coreByTag.set(signature, tag);
  }
  const tags = [...coreByTag.values()];
  for (let left = 0; left < tags.length; left += 1) for (let right = left + 1; right < tags.length; right += 1) {
    const a = new Map(tags[left].core_questions.map((core) => [core.qid, core.option_id]));
    const b = new Map(tags[right].core_questions.map((core) => [core.qid, core.option_id]));
    const conflict = [...a].some(([qid, optionId]) => b.has(qid) && b.get(qid) !== optionId);
    if (!conflict) fail(bank, `core ambiguity: ${tags[left].id} and ${tags[right].id} can both be exactly matched`);
  }
  const eggQuestions = bank.questions.filter((question) => question.result_effect === "egg_only");
  if (!Array.isArray(bank.easter_eggs) || eggQuestions.length !== bank.easter_eggs.length) fail(bank, "egg_only questions and easter_eggs must match one-to-one");
  for (const question of eggQuestions) {
    const egg = bank.easter_eggs.find((item) => item.source_qid === question.id);
    if (!egg || egg.option_mapping?.length !== question.options.length || egg.option_mapping.some((item) => !item.option_id || !item.label || !item.desc)) fail(bank, `Q${question.id} has incomplete easter egg configuration`);
  }
}

for (const [name, prefix] of BANKS) {
  const file = path.join(root, "data", "banks", `${name}.v5.0.0.json`);
  const bank = JSON.parse(fs.readFileSync(file, "utf8"));
  validateBank(bank, prefix);
  console.log(`PASS ${name}: ${bank.questions.length} questions, ${bank.tags.length} tags`);
}
