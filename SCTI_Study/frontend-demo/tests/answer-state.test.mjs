import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
  buildAnswerPayload,
  normalizeStoredAnswers,
  restoreProgressSnapshot,
  shouldAutoAdvance
} from "../answer-state.mjs";

const require = createRequire(import.meta.url);
const bank = require("../data/university.v5.0.0.public.json");

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

test("restored answers from another version are rejected", () => {
  const restored = restoreProgressSnapshot({
    version: "high_school",
    bankVersion: bank.bank_version,
    answers: { 1: 0 }
  }, bank);

  assert.equal(restored, null);
});

test("restored progress requires a matching version and bank version", () => {
  assert.equal(restoreProgressSnapshot({ answers: { 1: 0 } }, bank), null);
  assert.equal(restoreProgressSnapshot({
    version: bank.version,
    bankVersion: "4.9.0",
    answers: { 1: 0 }
  }, bank), null);
});

test("restored progress keeps snapshot metadata and normalizes answers", () => {
  const restored = restoreProgressSnapshot({
    version: bank.version,
    bankVersion: bank.bank_version,
    answers: { 1: "2", 2: 99 }
  }, bank);

  assert.deepEqual(restored.answers, { 1: 2 });
  assert.equal(restored.version, bank.version);
  assert.equal(restored.bankVersion, bank.bank_version);
});

test("a delayed auto-advance cannot skip another question after manual navigation", () => {
  assert.equal(shouldAutoAdvance("quiz", 0, 0), true);
  assert.equal(shouldAutoAdvance("quiz", 1, 0), false);
  assert.equal(shouldAutoAdvance("analysis", 0, 0), false);
});
