export function enabledVersions(registry) {
  return [...registry.versions]
    .filter((item) => item.enabled)
    .sort((a, b) => a.order - b.order);
}

export function findVersion(registry, id) {
  const item = enabledVersions(registry).find((version) => version.id === id);
  if (!item) throw new Error("该测试版本暂不可用");
  return item;
}

export function progressKey(versionConfig) {
  return `${versionConfig.cache_namespace}:${versionConfig.bank_version}:progress`;
}

export function applyTheme(root, versionConfig) {
  root.style.setProperty("--version-accent", versionConfig.theme.accent);
  root.style.setProperty("--version-accent-light", versionConfig.theme.accent_light);
  root.style.setProperty("--version-card", versionConfig.theme.card);
}
