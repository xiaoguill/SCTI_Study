function enabledVersions(registry) {
  return [...(registry?.versions || [])]
    .filter((item) => item.enabled)
    .sort((left, right) => left.order - right.order);
}

function findVersion(registry, id) {
  const version = enabledVersions(registry).find((item) => item.id === id);
  if (!version) throw new Error("该测试版本暂不可用");
  return version;
}

function progressKey(versionConfig) {
  if (!versionConfig?.cache_namespace || !versionConfig?.bank_version) {
    throw new Error("测试版本配置不完整");
  }
  return `${versionConfig.cache_namespace}:${versionConfig.bank_version}:progress`;
}

module.exports = { enabledVersions, findVersion, progressKey };
