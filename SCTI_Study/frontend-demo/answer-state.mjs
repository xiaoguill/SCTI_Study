function normalizedSelection(question, rawValue) {
  const value = typeof rawValue === "string" && rawValue.trim() !== ""
    ? Number(rawValue)
    : rawValue;
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value >= question.options.length) return null;
  return value;
}

export function normalizeStoredAnswers(questions, storedAnswers) {
  if (!storedAnswers || typeof storedAnswers !== "object" || Array.isArray(storedAnswers)) return {};
  const normalized = {};
  for (const question of questions) {
    const selected = normalizedSelection(question, storedAnswers[question.id]);
    if (selected !== null) normalized[question.id] = selected;
  }
  return normalized;
}

export function firstUnansweredIndex(questions, answers) {
  return questions.findIndex((question) => normalizedSelection(question, answers?.[question.id]) === null);
}

export function buildAnswerPayload(questions, answers) {
  const missingIndex = firstUnansweredIndex(questions, answers);
  if (missingIndex !== -1) {
    const error = new Error(`第 ${missingIndex + 1} 题尚未完成，请补充后再查看结果`);
    error.questionIndex = missingIndex;
    throw error;
  }
  return questions.map((question) => ({
    qid: question.id,
    selected: normalizedSelection(question, answers[question.id])
  }));
}

export function shouldAutoAdvance(screen, currentIndex, scheduledIndex) {
  return screen === "quiz" && currentIndex === scheduledIndex;
}
