import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { shouldAutoAdvance } from "../answer-state.mjs";
import {
  attemptNativeShare,
  hasCompleteResult,
  identityCardModels,
  isCurrentOperation,
  orchestrateShare,
  questionHint
} from "../ui-model.mjs";

const require = createRequire(import.meta.url);
const registry = require("../data/runtime-registry.json");
const privateBanks = Object.fromEntries(["high_school", "university", "graduate"].map((version) => [
  version,
  require(`../../data/banks/${version}.v5.0.0.json`)
]));

function completeResult() {
  return {
    tag_id: "tag-1",
    tag_name: "测试标签",
    tag_short_desc: "简短描述",
    tag_full_desc: { paragraph_1: "完整描述一", paragraph_2: "完整描述二", paragraph_3: "完整描述三" },
    keywords: ["关键词一", "关键词二"],
    share_copy: "分享文案",
    dimensions: {
      labels: ["维度一", "维度二", "维度三", "维度四"],
      user_vector: [1, 2.5, 4, 5],
      manhattan_distance: 2.5
    },
    easter_eggs: [{ qid: 6, value: "彩蛋内容" }],
    self_perception: { qid: 20, option_id: "A", text: "自我认知" }
  };
}

test("identity cards are generated from three enabled registry entries", () => {
  const cards = identityCardModels(registry, "university");
  assert.deepEqual(cards.map((item) => item.id), ["high_school", "university", "graduate"]);
  assert.equal(cards.find((item) => item.id === "university").selected, true);
});

test("question hints distinguish eggs and self perception", () => {
  assert.match(questionHint({ result_effect: "egg_only" }), /彩蛋/);
  assert.match(questionHint({ result_effect: "self_perception_only" }), /不参与主标签/);
});

test("app source does not embed canonical questions or tag names", () => {
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  for (const bank of Object.values(privateBanks)) {
    assert.equal(source.includes(bank.questions[0].text), false);
    assert.equal(source.includes(bank.tags[0].name), false);
  }
});

test("visible version copy is registry driven", () => {
  const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const fixedCopy of ["三版本", "高中、大学、硕博", "高中、大学或硕博", "V5.0"]) {
    assert.equal(appSource.includes(fixedCopy), false, fixedCopy);
    assert.equal(htmlSource.includes(fixedCopy), false, fixedCopy);
  }
  assert.match(htmlSource, /<title>校园人设测试 · Demo<\/title>/);
});

test("result rendering requires every unified server field", () => {
  const result = completeResult();

  assert.equal(hasCompleteResult(result), true);
  for (const field of ["share_copy", "self_perception", "easter_eggs", "dimensions"]) {
    assert.equal(hasCompleteResult({ ...result, [field]: undefined }), false, field);
  }
  assert.equal(hasCompleteResult({
    ...result,
    tag_full_desc: { paragraph_1: "完整描述一", paragraph_3: "完整描述三" }
  }), false, "tag_full_desc.paragraph_2");
});

test("result strings and keywords must be nonempty", () => {
  const result = completeResult();
  assert.equal(hasCompleteResult({ ...result, tag_name: "  " }), false);
  assert.equal(hasCompleteResult({ ...result, share_copy: "" }), false);
  assert.equal(hasCompleteResult({ ...result, keywords: ["有效", " "] }), false);
});

test("result dimensions require four finite user values in range without a target vector", () => {
  const result = completeResult();
  assert.equal(hasCompleteResult(result), true);
  assert.equal(hasCompleteResult({ ...result, dimensions: { ...result.dimensions, labels: result.dimensions.labels.slice(0, 3) } }), false);
  assert.equal(hasCompleteResult({ ...result, dimensions: { ...result.dimensions, user_vector: [1, 2, Number.NaN, 4] } }), false);
});

test("result eggs and self perception require valid nested values", () => {
  const result = completeResult();
  assert.equal(hasCompleteResult({ ...result, easter_eggs: [{ qid: "6", value: "彩蛋" }] }), false);
  assert.equal(hasCompleteResult({ ...result, easter_eggs: [{ qid: 6, value: " " }] }), false);
  assert.equal(hasCompleteResult({ ...result, self_perception: { qid: "20", option_id: "A", text: "自我认知" } }), false);
  assert.equal(hasCompleteResult({ ...result, self_perception: { qid: 20, option_id: "", text: "自我认知" } }), false);
});

test("self perception is exactly Q20 with an A-P option", () => {
  const result = completeResult();
  for (const selfPerception of [
    { qid: 19, option_id: "A", text: "自我认知" },
    { qid: 20, option_id: "a", text: "自我认知" },
    { qid: 20, option_id: "AA", text: "自我认知" },
    { qid: 20, option_id: "Q", text: "自我认知" },
    { qid: 20, option_id: 1, text: "自我认知" },
    { qid: 20, option_id: "P", text: " " }
  ]) {
    assert.equal(hasCompleteResult({ ...result, self_perception: selfPerception }), false);
  }
});

test("stale selection and submit operations are rejected", () => {
  const current = {
    token: 7,
    version: "graduate",
    bankVersion: "5.0.0",
    progressKey: "graduate:5.0.0:progress"
  };

  assert.equal(isCurrentOperation({ ...current, token: 6 }, current), false);
  assert.equal(isCurrentOperation({ ...current, version: "university" }, current), false);
  assert.equal(isCurrentOperation(current, current), true);
});

test("delayed auto-advance rejects a changed runtime", () => {
  const scheduled = {
    token: 3,
    version: "university",
    bankVersion: "5.0.0",
    progressKey: "university:5.0.0:progress"
  };
  const switched = {
    token: 4,
    version: "graduate",
    bankVersion: "5.0.0",
    progressKey: "graduate:5.0.0:progress"
  };

  assert.equal(shouldAutoAdvance("quiz", 4, 4), true);
  assert.equal(isCurrentOperation(scheduled, switched), false);
});

test("native share rejection returns a modal fallback signal", async () => {
  const payload = { title: "测试", text: "分享", url: "https://example.test" };
  assert.equal(await attemptNativeShare(null, payload), false);
  assert.equal(await attemptNativeShare(async () => { throw new Error("cancelled"); }, payload), false);
  assert.equal(await attemptNativeShare(async () => undefined, payload), true);
});

test("share orchestration silently rejects a stale continuation", async () => {
  let current = true;
  let nativeShareCalls = 0;
  const outcome = await orchestrateShare({
    operation: { token: 4, version: "university", bankVersion: "5.0.0" },
    isCurrent: () => current,
    recordShare: async () => {
      current = false;
      return { code: 0 };
    },
    recordPayload: { record_id: "record-1" },
    nativeShare: async () => { nativeShareCalls += 1; },
    sharePayload: { title: "测试", text: "分享", url: "https://example.test" }
  });

  assert.deepEqual(outcome, { status: "stale", showModal: false, feedback: "" });
  assert.equal(nativeShareCalls, 0);
});

test("share orchestration also rejects staleness after native share", async () => {
  let current = true;
  const outcome = await orchestrateShare({
    operation: { token: 4, version: "university", bankVersion: "5.0.0" },
    isCurrent: () => current,
    recordShare: async () => ({ code: 0 }),
    recordPayload: { record_id: "record-1" },
    nativeShare: async () => { current = false; },
    sharePayload: { title: "测试", text: "分享", url: "https://example.test" }
  });

  assert.deepEqual(outcome, { status: "stale", showModal: false, feedback: "" });
});

test("record-share rejection remains visible after native share succeeds", async () => {
  const outcome = await orchestrateShare({
    operation: { token: 4, version: "university", bankVersion: "5.0.0" },
    isCurrent: () => true,
    recordShare: async () => { throw new Error("record failed"); },
    recordPayload: { record_id: "record-1" },
    nativeShare: async () => undefined,
    sharePayload: { title: "测试", text: "分享", url: "https://example.test" }
  });

  assert.equal(outcome.status, "record_failed");
  assert.equal(outcome.showModal, true);
  assert.match(outcome.feedback, /分享记录暂时失败/);
});

test("record-share business failure remains visible", async () => {
  const outcome = await orchestrateShare({
    operation: { token: 4, version: "university", bankVersion: "5.0.0" },
    isCurrent: () => true,
    recordShare: async () => ({ code: 1, message: "failed" }),
    recordPayload: { record_id: "record-1" },
    nativeShare: async () => undefined,
    sharePayload: { title: "测试", text: "分享", url: "https://example.test" }
  });

  assert.equal(outcome.status, "record_failed");
  assert.equal(outcome.showModal, true);
});
