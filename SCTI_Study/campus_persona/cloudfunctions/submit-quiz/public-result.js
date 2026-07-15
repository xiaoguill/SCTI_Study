function toPublicResult(result) {
  return {
    version: result.version,
    bank_version: result.bank_version,
    algorithm_version: result.algorithm_version,
    tag_id: result.tag_id,
    tag_name: result.tag_name,
    tag_short_desc: result.tag_short_desc,
    tag_full_desc: result.tag_full_desc,
    keywords: result.keywords,
    share_copy: result.share_copy,
    match_method: result.match_method,
    dimensions: {
      labels: result.dimensions.labels,
      user_vector: result.dimensions.user_vector,
      manhattan_distance: result.dimensions.manhattan_distance
    },
    easter_eggs: result.easter_eggs,
    self_perception: result.self_perception
  };
}

module.exports = { toPublicResult };
