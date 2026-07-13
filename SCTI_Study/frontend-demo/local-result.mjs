import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bank = require("../campus_persona/data/university-bank.json");
const { calculateResult } = require("../campus_persona/cloudfunctions/submit-quiz/algorithm");

export function calculateLocalResult(data) {
  if (!data || data.version !== "university") {
    throw new Error("only the university bank is available in the local demo");
  }

  const serverResult = calculateResult(data.answers, bank);
  return {
    code: 0,
    message: "local demo",
    data: {
      record_id: "local-demo-record",
      server_result: serverResult,
      match_confirmed: serverResult.match_method === "core",
      tag_stats: { total_tested: 0, this_tag_count: 0, this_tag_percentage: 0 }
    }
  };
}
