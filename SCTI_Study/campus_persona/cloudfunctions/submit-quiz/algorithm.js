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

function mainResultQuestionIds(bank, profile) {
  const excluded = new Set(profile.main_result.excluded_question_ids);
  return new Set(bank.questions
    .filter((question) => question.result_effect === profile.scored_effect && !excluded.has(question.id))
    .map((question) => question.id));
}

function coreCandidates(answers, bank, profile, includedIds) {
  const answerMap = new Map(answers.map(({ qid, selected }) => [qid, selected]));
  const questions = new Map(bank.questions.map((question) => [question.id, question]));
  return bank.tags.filter((tag) => {
    const projected = tag.core_questions.filter((core) => includedIds.has(core.qid));
    return projected.length >= profile.core.minimum_projected_questions
      && projected.every((core) => questions.get(core.qid).options[answerMap.get(core.qid)]?.id === core.option_id);
  });
}

function layer2ScoreAccumulate(answers, bank, includedIds) {
  const questions = questionMap(bank);
  const scores = Object.fromEntries(bank.tags.map((tag) => [tag.id, 0]));
  for (const answer of answers) {
    if (!includedIds.has(answer.qid)) continue;
    const option = questions.get(answer.qid).options[answer.selected];
    for (const tag of bank.tags) scores[tag.id] += option.scores?.[tag.id] || 0;
  }
  return Object.entries(scores)
    .map(([tagId, score]) => ({ tagId, score }))
    .sort((a, b) => b.score - a.score || a.tagId.localeCompare(b.tagId));
}

function calculateUserVector(answers, bank, includedIds, precision = 2) {
  const questions = questionMap(bank);
  const sums = [0, 0, 0, 0];
  let count = 0;
  for (const answer of answers) {
    if (!includedIds.has(answer.qid)) continue;
    const vector = questions.get(answer.qid).options[answer.selected].dimensions;
    if (!Array.isArray(vector) || vector.length !== 4) continue;
    vector.forEach((value, index) => { sums[index] += value; });
    count += 1;
  }
  return count ? sums.map((value) => Number((value / count).toFixed(precision))) : [3, 3, 3, 3];
}

function layer3DimensionFallback(answers, bank, includedIds, ranking, profile) {
  const userVector = calculateUserVector(answers, bank, includedIds, profile.dimension.precision);
  const topScore = ranking[0].score;
  const competitiveIds = new Set(ranking
    .filter((item) => item.score >= topScore - profile.dimension.candidate_score_gap)
    .map((item) => item.tagId));
  let best = null;
  for (const tag of sortedTags(bank.tags).filter((item) => competitiveIds.has(item.id))) {
    const distance = tag.dimensions.reduce((sum, value, index) => sum + Math.abs(userVector[index] - value), 0);
    if (!best || distance < best.distance || (distance === best.distance && tag.id.localeCompare(best.tagId) < 0)) {
      best = { tagId: tag.id, distance };
    }
  }
  return {
    tagId: best.tagId,
    matchMethod: "dimension",
    userVector,
    distance: Number(best.distance.toFixed(profile.dimension.precision))
  };
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

function selectCoreMatch(candidates, ranking, profile) {
  if (!profile.core.require_unique_match || candidates.length !== 1) return null;
  const candidate = candidates[0];
  const candidateScore = ranking.find((item) => item.tagId === candidate.id).score;
  if (ranking[0].score - candidateScore > profile.core.max_score_gap_from_leader) return null;
  return { tagId: candidate.id, matchMethod: "core" };
}

function calculateResult(answers, bank, profile) {
  validateAnswers(answers, bank);
  const includedIds = mainResultQuestionIds(bank, profile);
  const ranking = layer2ScoreAccumulate(answers, bank, includedIds);
  const core = selectCoreMatch(coreCandidates(answers, bank, profile, includedIds), ranking, profile);
  const scoreLead = ranking[0].score - ranking[1].score;
  const score = scoreLead >= profile.score.minimum_lead
    ? { tagId: ranking[0].tagId, matchMethod: "score" }
    : null;
  const selected = core || score || layer3DimensionFallback(answers, bank, includedIds, ranking, profile);
  const tag = bank.tags.find((item) => item.id === selected.tagId);
  const userVector = selected.userVector || calculateUserVector(answers, bank, includedIds, profile.dimension.precision);
  const distance = tag.dimensions.reduce((sum, value, index) => sum + Math.abs(userVector[index] - value), 0);
  const selfPerceptionQuestion = questionMap(bank).get(20);
  const selfPerceptionAnswer = answers.find((answer) => answer.qid === 20);
  const option = selfPerceptionQuestion.options[selfPerceptionAnswer.selected];
  return {
    version: bank.version,
    bank_version: bank.bank_version,
    algorithm_version: profile.id,
    tag_id: tag.id,
    tag_name: tag.name,
    tag_short_desc: tag.short_desc,
    tag_full_desc: tag.full_desc,
    keywords: tag.keywords,
    share_copy: tag.share_copy,
    match_method: selected.matchMethod,
    scores_ranking: ranking,
    dimensions: {
      labels: bank.dimension_config.labels,
      user_vector: userVector,
      target_vector: tag.dimensions,
      manhattan_distance: Number(distance.toFixed(profile.dimension.precision))
    },
    easter_eggs: collectEasterEggs(answers, bank),
    self_perception: { qid: 20, option_id: option.id, text: option.text }
  };
}

module.exports = {
  calculateResult,
  calculateUserVector,
  collectEasterEggs,
  coreCandidates,
  layer2ScoreAccumulate,
  layer3DimensionFallback,
  mainResultQuestionIds,
  validateAnswers
};
