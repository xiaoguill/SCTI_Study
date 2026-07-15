function buildResultPosterModel(result, presentation, version) {
  const model = {
    template_key: presentation?.poster?.template_key || "persona-result-v1",
    safe_area: presentation?.poster?.safe_area || "center",
    version_id: version?.id || "",
    version_title: version?.title || "",
    theme_color: version?.theme?.accent || "#f7f0e3",
    hero_background: presentation?.hero_background || "#f7f0e3",
    tag_id: result?.tag_id || "",
    tag_name: result?.tag_name || "",
    tag_short_desc: result?.tag_short_desc || "",
    keywords: [...(result?.keywords || [])],
    character_image: presentation?.character_image || "",
    character_position: presentation?.poster?.character_position || "center_bottom",
    character_scale: presentation?.character_scale || 1,
    share_copy: result?.share_copy || "",
    qr_payload: ""
  };
  Object.freeze(model.keywords);
  return Object.freeze(model);
}

module.exports = { buildResultPosterModel };
