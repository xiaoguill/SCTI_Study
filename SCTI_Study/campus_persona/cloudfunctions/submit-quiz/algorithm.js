const EFFECT_SCORED = "scored";

function sortedTags(tags) {
  return [...tags].sort((a, b) => a.id.localeCompare(b.id));
}

function questionMap(bank) {
  return new Map(bank.questions.map((question) => [question.id, question]));
}

function validateAnswers(answers, bank) {
  if (!Array.isArray(answers) || answers.length !== bank.questions.length) {
    throw new Error("answers must contain every question exactly once");
  }
  const questions = questionMap(bank);
  const seen = new Set();
  for (const answer of answers) {
    if (!Number.isInteger(answer.qid) || !Number.isInteger(answer.selected)) throw new Error("invalid answer shape");
    if (seen.has(answer.qid)) throw new Error("duplicate question answer");
    const question = questions.get(answer.qid);
    if (!question || answer.selected < 0 || answer.selected >= question.options.length) throw new Error("answer is out of range");
    seen.add(answer.qid);
  }
  if (seen.size !== bank.questions.length) throw new Error("answers are incomplete");
}

function layer1CoreMatch(answers, tags) {
  const answerMap = new Map(answers.map((answer) => [answer.qid, answer.selected]));
  for (const tag of sortedTags(tags)) {
    if (!tag.core_questions?.length) continue;
    const matched = tag.core_questions.every((core) => answerMap.get(core.qid) === core.answer_index);
    if (matched) return { tagId: tag.id, matchMethod: "core" };
  }
  return null;
}

function layer2ScoreAccumulate(answers, bank) {
  const questions = questionMap(bank);
  const scores = Object.fromEntries(bank.tags.map((tag) => [tag.id, 0]));
  for (const answer of answers) {
    const question = questions.get(answer.qid);
    if (question.result_effect !== EFFECT_SCORED) continue;
    const option = question.options[answer.selected];
    for (const tag of bank.tags) scores[tag.id] += option.scores?.[tag.id] || 0;
  }
  const ranking = Object.entries(scores)
    .map(([tagId, score]) => ({ tagId, score }))
    .sort((a, b) => b.score - a.score || a.tagId.localeCompare(b.tagId));
  if (ranking[0].score - ranking[1].score >= 3) return { tagId: ranking[0].tagId, matchMethod: "score", ranking };
  return { ranking };
}

function calculateUserVector(answers, bank) {
  const questions = questionMap(bank);
  const sums = [0, 0, 0, 0];
  let count = 0;
  for (const answer of answers) {
    const question = questions.get(answer.qid);
    if (question.result_effect !== EFFECT_SCORED) continue;
    const vector = question.options[answer.selected].dimensions;
    if (!Array.isArray(vector) || vector.length !== 4) continue;
    vector.forEach((value, index) => { sums[index] += value; });
    count += 1;
  }
  return count ? sums.map((value) => Number((value / count).toFixed(2))) : [3, 3, 3, 3];
}

function layer3DimensionFallback(answers, bank) {
  const userVector = calculateUserVector(answers, bank);
  let best = null;
  for (const tag of sortedTags(bank.tags)) {
    const distance = tag.dimensions.reduce((sum, value, index) => sum + Math.abs(userVector[index] - value), 0);
    if (!best || distance < best.distance) best = { tagId: tag.id, distance };
  }
  return { tagId: best.tagId, matchMethod: "dimension", userVector, distance: Number(best.distance.toFixed(2)) };
}

function collectEasterEggs(answers, bank) {
  const questions = questionMap(bank);
  return answers.flatMap((answer) => {
    const question = questions.get(answer.qid);
    if (question.result_effect !== "egg_only") return [];
    const option = question.options[answer.selected];
    return option.easter_egg ? [{ qid: answer.qid, value: option.easter_egg }] : [];
  });
}

function calculateResult(answers, bank) {
  validateAnswers(answers, bank);
  const core = layer1CoreMatch(answers, bank.tags);
  const scoreResult = layer2ScoreAccumulate(answers, bank);
  const selected = core || (scoreResult.matchMethod ? scoreResult : layer3DimensionFallback(answers, bank));
  const tag = bank.tags.find((item) => item.id === selected.tagId);
  const userVector = selected.userVector || calculateUserVector(answers, bank);
  const distance = tag.dimensions.reduce((sum, value, index) => sum + Math.abs(userVector[index] - value), 0);
  return {
    tag_id: tag.id,
    tag_name: tag.name,
    tag_short_desc: tag.short_desc,
    tag_full_desc: tag.full_desc,
    keywords: tag.keywords,
    match_method: selected.matchMethod,
    scores_ranking: scoreResult.ranking,
    dimensions: {
      labels: ["学业投入度", "社交活跃度", "自律执行力", "探索开放性"],
      user_vector: userVector,
      target_vector: tag.dimensions,
      manhattan_distance: Number(distance.toFixed(2))
    },
    easter_eggs: collectEasterEggs(answers, bank)
  };
}

module.exports = {
  calculateResult,
  calculateUserVector,
  layer1CoreMatch,
  layer2ScoreAccumulate,
  layer3DimensionFallback,
  validateAnswers
};
