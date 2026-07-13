import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const canonicalPath = path.join(workspaceRoot, "data", "banks", "university.v5.0.0.json");
const bank = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));

const publicBank = {
  "$schema": "../../schemas/question-bank.schema.json",
  version: bank.version,
  bank_version: bank.bank_version,
  status: bank.status,
  dimension_config: bank.dimension_config,
  tags: bank.tags.map(({ id, prefix, name, short_desc, full_desc, keywords, dimensions, share_copy }) => ({ id, prefix, name, short_desc, full_desc, keywords, dimensions, share_copy })),
  questions: bank.questions.map(({ id, text, type, result_effect, emoji_type, options }) => ({
    id, text, type, result_effect, emoji_type,
    options: options.map(({ id: option_id, index, text }) => ({ id: option_id, index, text }))
  })),
  easter_eggs: bank.easter_eggs
};

function write(relativePath, value) {
  const target = path.resolve(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

write("data/university-bank.json", bank);
write("cloudfunctions/submit-quiz/university-bank.json", bank);
write("cloudfunctions/get-bank/university-bank.public.json", publicBank);
write("../frontend-demo/data/university-bank.public.json", publicBank);
console.log(`Built university bank ${bank.bank_version}: ${bank.questions.length} questions, ${bank.tags.length} tags`);
