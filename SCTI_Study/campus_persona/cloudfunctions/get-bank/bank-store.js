const registry = require("./data/runtime-registry.json");

class BankRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function getVersionConfig(version) {
  const versionConfig = registry.versions.find((item) => item.id === version);
  if (!versionConfig || !versionConfig.enabled) {
    throw new BankRequestError(404, "题库版本不存在或已关闭");
  }
  return versionConfig;
}

function getPublicBank(version, clientBankVersion) {
  const versionConfig = getVersionConfig(version);
  const bank = require(`./data/${versionConfig.public_bank_file}`);
  return {
    ...bank,
    need_update: clientBankVersion !== bank.bank_version
  };
}

const publicRegistry = {
  ...registry,
  versions: registry.versions.filter((item) => item.enabled)
};

module.exports = { BankRequestError, getPublicBank, publicRegistry };
