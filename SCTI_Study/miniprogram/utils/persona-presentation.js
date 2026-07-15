function resolvePersonaPresentation(config, version, tagId, fallbackIcon) {
  const key = `${version}:${tagId}`;
  const defaultPresentation = config?.default || {};
  const override = config?.tags?.[key] || {};
  const selected = { ...defaultPresentation, ...override };
  return {
    character_image: selected.character_image || "",
    character_alt: selected.character_alt || "校园人设角色",
    character_position: ["center_bottom", "center", "left_bottom", "right_bottom"].includes(selected.character_position)
      ? selected.character_position : "center_bottom",
    character_scale: Number.isFinite(selected.character_scale) ? selected.character_scale : 1,
    hero_background: /^#[0-9a-fA-F]{6}$/.test(selected.hero_background || "") ? selected.hero_background : "#f7f0e3",
    decorations: (Array.isArray(selected.decorations) ? selected.decorations : []).filter((item) => ["star", "sparkle", "leaf"].includes(item)),
    visual_brief: selected.visual_brief || "",
    asset_status: selected.asset_status || "placeholder",
    poster: { ...(defaultPresentation.poster || {}), ...(override.poster || {}) },
    fallback_icon: fallbackIcon || "✦"
  };
}

module.exports = { resolvePersonaPresentation };
