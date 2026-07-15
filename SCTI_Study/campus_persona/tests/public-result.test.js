const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { calculateResult } = require("../cloudfunctions/submit-quiz/algorithm");
const { toPublicResult } = require("../cloudfunctions/submit-quiz/public-result");

function readGeneratedJson(...segments) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", ...segments), "utf8"));
}

test("public result exposes the complete render contract without internal scoring data", () => {
  const bank = readGeneratedJson("banks", "university.v5.0.0.json");
  const profile = readGeneratedJson("algorithms", "three-layer.v2.0.0.json");
  const answers = bank.questions.map((question) => ({ qid: question.id, selected: 0 }));
  const internalResult = calculateResult(answers, bank, profile);
  const publicResult = toPublicResult(internalResult);

  assert.deepEqual(Object.keys(publicResult).sort(), [
    "algorithm_version",
    "bank_version",
    "dimensions",
    "easter_eggs",
    "keywords",
    "match_method",
    "self_perception",
    "share_copy",
    "tag_full_desc",
    "tag_id",
    "tag_name",
    "tag_short_desc",
    "version"
  ].sort());
  assert.deepEqual(Object.keys(publicResult.dimensions).sort(), [
    "labels",
    "manhattan_distance",
    "user_vector"
  ].sort());
  assert.equal("scores_ranking" in publicResult, false);
  assert.equal("target_vector" in publicResult.dimensions, false);
  assert.equal(publicResult.version, bank.version);
  assert.equal(publicResult.bank_version, bank.bank_version);
  assert.equal(publicResult.algorithm_version, profile.id);
  assert.equal(publicResult.tag_id, internalResult.tag_id);
  assert.deepEqual(publicResult.tag_full_desc, internalResult.tag_full_desc);
  assert.deepEqual(publicResult.keywords, internalResult.keywords);
  assert.deepEqual(publicResult.easter_eggs, internalResult.easter_eggs);
  assert.deepEqual(publicResult.self_perception, internalResult.self_perception);
});
