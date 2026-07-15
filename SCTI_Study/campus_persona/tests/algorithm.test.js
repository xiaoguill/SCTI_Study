const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculateResult, mainResultQuestionIds } = require("../cloudfunctions/submit-quiz/algorithm");

function readGeneratedJson(...segments) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", ...segments), "utf8"));
}

const profile = readGeneratedJson("algorithms", "three-layer.v2.0.0.json");
const banks = Object.fromEntries(["high_school", "university", "graduate"].map((version) => [
  version,
  readGeneratedJson("banks", `${version}.v5.0.0.json`)
]));
const golden = JSON.parse(fs.readFileSync(path.resolve(__dirname, "fixtures", "algorithm-golden.json"), "utf8"));

function completeAnswers(bank, overrides = {}) {
  return bank.questions.map((question) => ({
    qid: question.id,
    selected: overrides[question.id] ?? 0
  }));
}

test("main result question ids use the profile's scored effect and exclusions", () => {
  const bank = banks.university;
  const ids = mainResultQuestionIds(bank, profile);
  assert.equal(ids.has(20), false);
  assert.deepEqual([...ids], bank.questions
    .filter((question) => question.result_effect === profile.scored_effect && question.id !== 20)
    .map((question) => question.id));
});

for (const version of ["high_school", "university", "graduate"]) {
  test(`${version}: changing only Q20 cannot change persona or dimensions`, () => {
    const bank = banks[version];
    const baseline = completeAnswers(bank, { 20: 0 });
    const expected = calculateResult(baseline, bank, profile);
    for (let selected = 1; selected < 16; selected += 1) {
      const actual = calculateResult(completeAnswers(bank, { 20: selected }), bank, profile);
      assert.equal(actual.tag_id, expected.tag_id);
      assert.deepEqual(actual.dimensions.user_vector, expected.dimensions.user_vector);
      assert.equal(actual.self_perception.option_id, bank.questions[19].options[selected].id);
    }
  });
}

test("dimension labels and share copy come from the selected bank", () => {
  const bank = banks.high_school;
  const result = calculateResult(completeAnswers(bank), bank, profile);
  const tag = bank.tags.find((item) => item.id === result.tag_id);
  assert.deepEqual(result.dimensions.labels, bank.dimension_config.labels);
  assert.equal(result.share_copy, tag.share_copy);
});

test("user vector honors the configured dimension precision", () => {
  const bank = banks.university;
  const configuredProfile = structuredClone(profile);
  configuredProfile.dimension.precision = 3;
  const answers = completeAnswers(bank);
  const includedIds = mainResultQuestionIds(bank, configuredProfile);
  const includedAnswers = answers.filter((answer) => includedIds.has(answer.qid));
  const questionById = new Map(bank.questions.map((question) => [question.id, question]));
  const expected = [0, 1, 2, 3].map((dimension) => Number((includedAnswers.reduce((sum, answer) => (
    sum + questionById.get(answer.qid).options[answer.selected].dimensions[dimension]
  ), 0) / includedAnswers.length).toFixed(3)));

  assert.ok(expected.some((value) => value !== Number(value.toFixed(2))), "fixture must distinguish precision 3 from precision 2");
  assert.deepEqual(calculateResult(answers, bank, configuredProfile).dimensions.user_vector, expected);
});

for (const [version, expected] of Object.entries(golden)) {
  test(`${version}: matches the stable baseline result`, () => {
    const bank = banks[version];
    const result = calculateResult(completeAnswers(bank, expected.overrides), bank, profile);
    assert.equal(result.tag_id, expected.tag_id);
    assert.equal(result.match_method, expected.match_method);
    assert.equal(result.version, bank.version);
    assert.equal(result.bank_version, bank.bank_version);
    assert.equal(result.algorithm_version, profile.id);
  });
}
