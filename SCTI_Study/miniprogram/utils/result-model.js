const isNonemptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isDimensionValue = (value) => Number.isFinite(value) && value >= 1 && value <= 5;

function hasCompleteResult(result) {
  const descriptions = result?.tag_full_desc;
  const dimensions = result?.dimensions;
  const selfPerception = result?.self_perception;
  return Boolean(
    result
    && isNonemptyString(result.version)
    && isNonemptyString(result.bank_version)
    && isNonemptyString(result.algorithm_version)
    && isNonemptyString(result.tag_id)
    && isNonemptyString(result.tag_name)
    && isNonemptyString(result.tag_short_desc)
    && descriptions && ["paragraph_1", "paragraph_2", "paragraph_3"].every((field) => isNonemptyString(descriptions[field]))
    && Array.isArray(result.keywords) && result.keywords.length > 0 && result.keywords.every(isNonemptyString)
    && isNonemptyString(result.share_copy)
    && isNonemptyString(result.match_method)
    && dimensions
    && Array.isArray(dimensions.labels) && dimensions.labels.length === 4 && dimensions.labels.every(isNonemptyString)
    && Array.isArray(dimensions.user_vector) && dimensions.user_vector.length === 4 && dimensions.user_vector.every(isDimensionValue)
    && Number.isFinite(dimensions.manhattan_distance)
    && Array.isArray(result.easter_eggs)
    && result.easter_eggs.every((egg) => Number.isInteger(egg?.qid) && isNonemptyString(egg?.value))
    && selfPerception?.qid === 20
    && typeof selfPerception.option_id === "string" && /^[A-P]$/.test(selfPerception.option_id)
    && isNonemptyString(selfPerception.text)
  );
}

module.exports = { hasCompleteResult };
