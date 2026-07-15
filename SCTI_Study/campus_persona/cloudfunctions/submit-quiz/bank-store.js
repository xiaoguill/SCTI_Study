const registry = require("./data/runtime-registry.json");

class BankRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function getRuntime(version, bankVersion) {
  const versionConfig = registry.versions.find((item) => item.id === version);
  if (!versionConfig || !versionConfig.enabled) {
    throw new BankRequestError(404, "题库版本不存在或已关闭");
  }
  if (bankVersion !== versionConfig.bank_version) {
    throw new BankRequestError(409, "题库已更新，请刷新后重新提交");
  }
  const bank = require(`./data/banks/${versionConfig.id}.v${versionConfig.bank_version}.json`);
  const profile = require(`./data/algorithms/${bank.algorithm_profile}.json`);
  return { versionConfig, bank, profile };
}

module.exports = { BankRequestError, getRuntime };
