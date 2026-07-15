function selectedIndex(question, value) {
  if (value === "" || value === null || value === undefined) return null;
  const selected = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(selected) || selected < 0 || selected >= question.options.length) return null;
  return selected;
}

function normalizeStoredAnswers(questions, answers) {
  const normalized = {};
  for (const question of questions || []) {
    const selected = selectedIndex(question, answers?.[question.id]);
    if (selected !== null) normalized[question.id] = selected;
  }
  return normalized;
}

function buildAnswerPayload(questions, answers) {
  return (questions || []).map((question, questionIndex) => {
    const selected = selectedIndex(question, answers?.[question.id]);
    if (selected === null) {
      const error = new Error(`第 ${questionIndex + 1} 题尚未完成`);
      error.questionIndex = questionIndex;
      throw error;
    }
    return { qid: question.id, selected };
  });
}

module.exports = { buildAnswerPayload, normalizeStoredAnswers };
