import assert from "node:assert/strict";
import test from "node:test";
import { submitQuiz } from "../api/cloud.js";
import { calculateLocalResult } from "../local-result.mjs";

function answers(overrides = {}) {
  return Array.from({ length: 20 }, (_, index) => ({
    qid: index + 1,
    selected: overrides[index + 1] ?? 0
  }));
}

test("local demo uses the three-layer algorithm instead of Q20 alone", () => {
  const q20Only = calculateLocalResult({
    version: "university",
    answers: answers({ 20: 5 })
  });
  const u6Core = calculateLocalResult({
    version: "university",
    answers: answers({ 2: 1, 16: 3, 20: 5 })
  });

  assert.equal(q20Only.data.server_result.match_method, "dimension");
  assert.equal(u6Core.data.server_result.tag_id, "U6");
  assert.equal(u6Core.data.server_result.match_method, "core");
  assert.notEqual(q20Only.data.server_result.tag_id, u6Core.data.server_result.tag_id);
});

test("local demo rejects incomplete answers instead of inventing a result", () => {
  assert.throws(
    () => calculateLocalResult({ version: "university", answers: [] }),
    /answers must contain every question exactly once/
  );
});

test("local demo explains how to recover when its result service is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  try {
    await assert.rejects(
      () => submitQuiz({ version: "university", answers: answers() }),
      /本地结果服务不可用，请运行 npm start 后重试/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
