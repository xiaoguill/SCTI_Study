import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
  buildAnswerPayload,
  normalizeStoredAnswers,
  shouldAutoAdvance
} from "../answer-state.mjs";

const require = createRequire(import.meta.url);
const bank = require("../data/university-bank.public.json");

function completeAnswers() {
  return Object.fromEntries(bank.questions.map((question) => [question.id, 0]));
}

test("submission points to the first missing answer before calling the result service", () => {
  const answers = completeAnswers();
  delete answers[7];

  assert.throws(
    () => buildAnswerPayload(bank.questions, answers),
    (error) => {
      assert.equal(error.questionIndex, 6);
      assert.match(error.message, /第 7 题尚未完成/);
      return true;
    }
  );
});

test("restored progress keeps valid numeric answers and drops malformed entries", () => {
  const normalized = normalizeStoredAnswers(bank.questions, {
    1: "2",
    2: 99,
    3: "not-an-option"
  });

  assert.deepEqual(normalized, { 1: 2 });
});

test("a delayed auto-advance cannot skip another question after manual navigation", () => {
  assert.equal(shouldAutoAdvance("quiz", 0, 0), true);
  assert.equal(shouldAutoAdvance("quiz", 1, 0), false);
  assert.equal(shouldAutoAdvance("analysis", 0, 0), false);
});
