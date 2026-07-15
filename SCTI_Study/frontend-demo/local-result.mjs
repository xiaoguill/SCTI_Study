import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { calculateResult } = require("../campus_persona/cloudfunctions/submit-quiz/algorithm");
const { toPublicResult } = require("../campus_persona/cloudfunctions/submit-quiz/public-result");
const registry = require("../campus_persona/data/runtime-registry.json");

const runtimes = new Map(registry.versions.map((versionConfig) => {
  const bank = require(`../campus_persona/data/banks/${versionConfig.id}.v${versionConfig.bank_version}.json`);
  const profile = require(`../campus_persona/data/algorithms/${bank.algorithm_profile}.json`);
  return [versionConfig.id, { versionConfig, bank, profile }];
}));

function getLocalRuntime(version, bankVersion) {
  const runtime = runtimes.get(version);
  if (!runtime || !runtime.versionConfig.enabled) {
    throw new Error("题库版本不存在或已关闭");
  }
  if (bankVersion !== runtime.versionConfig.bank_version) {
    throw new Error("题库已更新，请刷新后重新提交");
  }
  return runtime;
}

export function calculateLocalResult(data) {
  const { bank, profile } = getLocalRuntime(data?.version, data?.bank_version);

  const serverResult = toPublicResult(calculateResult(data.answers, bank, profile));
  return {
    code: 0,
    message: "success",
    data: {
      record_id: "local-demo-record",
      server_result: serverResult,
      match_confirmed: true,
      tag_stats: { total_tested: 0, this_tag_count: 0, this_tag_percentage: 0 }
    }
  };
}
