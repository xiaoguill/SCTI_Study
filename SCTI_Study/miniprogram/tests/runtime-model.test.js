const test = require("node:test");
const assert = require("node:assert/strict");

const runtime = require("../data/runtime");
const { runtimeMode } = require("../config/runtime");
const { enabledVersions, findVersion, progressKey } = require("../utils/version-context");
const { buildAnswerPayload, normalizeStoredAnswers } = require("../utils/answer-state");
const { hasCompleteResult } = require("../utils/result-model");

function validPublicResult() {
  return {
    version: "high_school",
    bank_version: "5.0.0",
    algorithm_version: "three-layer.v2.0.0",
    tag_id: "H1",
    tag_name: "题海纺织工",
    tag_short_desc: "你的笔和手长在一起了",
    tag_full_desc: {
      paragraph_1: "第一段完整结果说明文字。",
      paragraph_2: "第二段完整结果说明文字。",
      paragraph_3: "第三段完整结果说明文字。"
    },
    keywords: ["#题海纺织工", "#高中"],
    share_copy: "我测出是题海纺织工，来看看你的校园人设。",
    match_method: "score",
    dimensions: {
      labels: ["学习投入度", "社交活跃度", "自律执行力", "兴趣开放性"],
      user_vector: [4.5, 2.1, 4.2, 2.8],
      manhattan_distance: 2.2
    },
    easter_eggs: [{ qid: 5, value: "趣味彩蛋" }],
    self_perception: { qid: 20, option_id: "A", text: "自我认知" }
  };
}

test("only an exactly empty cloud environment selects local mode", () => {
  assert.equal(runtimeMode({ cloudEnvId: "" }), "local");
  assert.equal(runtimeMode({ cloudEnvId: "  " }), "cloud");
  assert.equal(runtimeMode({ cloudEnvId: "env-test" }), "cloud");
});

test("enabled versions follow registry order and require explicit ids", () => {
  assert.deepEqual(
    enabledVersions(runtime.registry).map(({ id }) => id),
    ["high_school", "university", "graduate"]
  );
  assert.equal(findVersion(runtime.registry, "graduate").title, "硕博版");
  assert.throws(() => findVersion(runtime.registry, ""), /该测试版本暂不可用/);
});

test("progress is isolated by namespace and bank version", () => {
  assert.equal(
    progressKey(findVersion(runtime.registry, "high_school")),
    "campus-persona-high-school:5.0.0:progress"
  );
  assert.notEqual(
    progressKey(findVersion(runtime.registry, "high_school")),
    progressKey(findVersion(runtime.registry, "graduate"))
  );
});

test("stored answers keep only numeric indices valid for each question", () => {
  const questions = runtime.banks.high_school.questions;
  assert.deepEqual(normalizeStoredAnswers(questions, { 1: 0, 2: "1", 3: 99, 20: 15 }), {
    1: 0,
    2: 1,
    20: 15
  });
});

test("answer payload identifies the first missing question", () => {
  const questions = runtime.banks.high_school.questions;
  const answers = Object.fromEntries(questions.map((question) => [question.id, 0]));
  delete answers[7];
  assert.throws(
    () => buildAnswerPayload(questions, answers),
    (error) => error.questionIndex === 6 && /第 7 题尚未完成/.test(error.message)
  );
});

test("result validation accepts the public DTO without private vectors", () => {
  const result = validPublicResult();
  assert.equal(hasCompleteResult(result), true);
  assert.equal("scores_ranking" in result, false);
  assert.equal("target_vector" in result.dimensions, false);
  assert.equal(hasCompleteResult({ ...result, tag_name: "" }), false);
  assert.equal(hasCompleteResult({ ...result, self_perception: { ...result.self_perception, option_id: "Q" } }), false);
});
