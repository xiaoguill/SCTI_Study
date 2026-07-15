import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { localDemoSubmit, submitQuiz, withTimeout } from "../api/cloud.js";
import { calculateLocalResult } from "../local-result.mjs";
import { hasCompleteResult } from "../ui-model.mjs";

const require = createRequire(import.meta.url);
const privateBanks = Object.fromEntries(["high_school", "university", "graduate"].map((version) => [
  version,
  require(`../../campus_persona/data/banks/${version}.v5.0.0.json`)
]));

function answers(overrides = {}) {
  return Array.from({ length: 20 }, (_, index) => ({
    qid: index + 1,
    selected: overrides[index + 1] ?? 0
  }));
}

test("local demo excludes Q20 self-perception from persona scoring", () => {
  const baseline = calculateLocalResult({
    version: "university",
    bank_version: privateBanks.university.bank_version,
    answers: answers()
  });
  const changedSelfPerception = calculateLocalResult({
    version: "university",
    bank_version: privateBanks.university.bank_version,
    answers: answers({ 20: 5 })
  });

  assert.equal(changedSelfPerception.data.server_result.tag_id, baseline.data.server_result.tag_id);
  assert.deepEqual(changedSelfPerception.data.server_result.dimensions.user_vector, baseline.data.server_result.dimensions.user_vector);
  assert.notEqual(changedSelfPerception.data.server_result.self_perception.option_id, baseline.data.server_result.self_perception.option_id);
});

test("local demo rejects incomplete answers instead of inventing a result", () => {
  assert.throws(
    () => calculateLocalResult({ version: "university", bank_version: privateBanks.university.bank_version, answers: [] }),
    /answers must contain every question exactly once/
  );
});

for (const version of ["high_school", "university", "graduate"]) {
  test(`local result supports ${version}`, () => {
    const bank = privateBanks[version];
    const response = calculateLocalResult({
      version,
      bank_version: bank.bank_version,
      answers: bank.questions.map((question) => ({ qid: question.id, selected: 0 }))
    });
    assert.equal(response.code, 0);
    assert.equal(response.data.server_result.version, version);
    assert.equal("scores_ranking" in response.data.server_result, false);
    assert.equal("target_vector" in response.data.server_result.dimensions, false);
    assert.equal(hasCompleteResult(response.data.server_result), true);
  });
}

test("local result rejects a stale bank version", () => {
  assert.throws(
    () => calculateLocalResult({ version: "university", bank_version: "4.9.0", answers: [] }),
    /题库已更新/
  );
});

test("withTimeout rejects after an injected short timeout", async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), "timed out", 1),
    /timed out/
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

test("local demo aborts an in-flight fetch when its timeout expires", async () => {
  let signal;
  const fetchImpl = (_url, options) => new Promise((_resolve, reject) => {
    signal = options.signal;
    signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  });

  await assert.rejects(
    () => localDemoSubmit({}, { fetchImpl, timeoutMs: 1 }),
    /本地结果服务超时/
  );
  assert.equal(signal.aborted, true);
});

test("local demo clears its abort timer after a completed fetch", async () => {
  let signal;
  await localDemoSubmit({}, {
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return { ok: true, json: async () => ({ code: 0 }) };
    },
    timeoutMs: 5
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(signal.aborted, false);
});

test("cloud transport errors use a recoverable Chinese message", async () => {
  const originalWx = globalThis.wx;
  globalThis.wx = { cloud: { callFunction: async () => { throw new Error("cloud unavailable"); } } };
  try {
    await assert.rejects(
      () => submitQuiz({ version: "university", bank_version: privateBanks.university.bank_version, answers: answers() }),
      /云端服务暂不可用，请稍后重试/
    );
  } finally {
    globalThis.wx = originalWx;
  }
});

test("cloud business response errors remain available to callers", async () => {
  const originalWx = globalThis.wx;
  const businessError = { code: 409, message: "题库已更新，请刷新后重新提交", data: null };
  globalThis.wx = { cloud: { callFunction: async () => ({ result: businessError }) } };
  try {
    assert.deepEqual(
      await submitQuiz({ version: "university", bank_version: privateBanks.university.bank_version, answers: answers() }),
      businessError
    );
  } finally {
    globalThis.wx = originalWx;
  }
});
