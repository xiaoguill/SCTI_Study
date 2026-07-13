const test = require("node:test");
const assert = require("node:assert/strict");
const bank = require("../data/university-bank.json");
const { calculateResult } = require("../cloudfunctions/submit-quiz/algorithm");

function answers(overrides = {}) {
  return bank.questions.map((question) => ({ qid: question.id, selected: overrides[question.id] ?? 0 }));
}

test("U6 uses corrected three-question core match", () => {
  const result = calculateResult(answers({ 2: 1, 16: 3, 20: 5 }), bank);
  assert.equal(result.tag_id, "U6");
  assert.equal(result.match_method, "core");
});

test("U13 uses corrected core questions Q2 + Q7 + Q20", () => {
  const result = calculateResult(answers({ 2: 3, 7: 3, 20: 12 }), bank);
  assert.equal(result.tag_id, "U13");
  assert.equal(result.match_method, "core");
});

test("Q20 alone cannot determine a campus persona", () => {
  const q20Only = calculateResult(answers({ 20: 5 }), bank);
  const u6Core = calculateResult(answers({ 2: 1, 16: 3, 20: 5 }), bank);
  assert.equal(q20Only.match_method, "dimension");
  assert.equal(u6Core.tag_id, "U6");
  assert.notEqual(q20Only.tag_id, u6Core.tag_id);
});

test("second layer requires a three-point lead", () => {
  const smallBank = {
    tags: [
      { id: "U1", name: "A", short_desc: "A", full_desc: {}, keywords: [], dimensions: [1, 1, 1, 1], core_questions: [] },
      { id: "U2", name: "B", short_desc: "B", full_desc: {}, keywords: [], dimensions: [5, 5, 5, 5], core_questions: [] }
    ],
    questions: [
      { id: 1, result_effect: "scored", options: [{ scores: { U1: 2 }, dimensions: [1, 1, 1, 1] }, { scores: { U2: 1 }, dimensions: [5, 5, 5, 5] }] },
      { id: 2, result_effect: "scored", options: [{ scores: { U1: 2 }, dimensions: [1, 1, 1, 1] }, { scores: { U2: 1 }, dimensions: [5, 5, 5, 5] }] }
    ]
  };
  const result = calculateResult([{ qid: 1, selected: 0 }, { qid: 2, selected: 0 }], smallBank);
  assert.equal(result.tag_id, "U1");
  assert.equal(result.match_method, "score");
});

test("third layer uses deterministic Manhattan fallback on ties", () => {
  const smallBank = {
    tags: [
      { id: "U1", name: "A", short_desc: "A", full_desc: {}, keywords: [], dimensions: [1, 1, 1, 1], core_questions: [] },
      { id: "U2", name: "B", short_desc: "B", full_desc: {}, keywords: [], dimensions: [5, 5, 5, 5], core_questions: [] }
    ],
    questions: [
      { id: 1, result_effect: "scored", options: [{ scores: { U1: 1, U2: 1 }, dimensions: [1, 1, 1, 1] }] },
      { id: 2, result_effect: "scored", options: [{ scores: { U1: 1, U2: 1 }, dimensions: [1, 1, 1, 1] }] }
    ]
  };
  const result = calculateResult([{ qid: 1, selected: 0 }, { qid: 2, selected: 0 }], smallBank);
  assert.equal(result.tag_id, "U1");
  assert.equal(result.match_method, "dimension");
});
