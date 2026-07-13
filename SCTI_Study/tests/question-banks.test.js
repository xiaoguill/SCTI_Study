const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const validatorUrl = pathToFileURL(path.resolve(__dirname, "..", "scripts", "validate-question-banks.mjs")).href;

test("all canonical banks pass the standalone validator", async () => {
  const validator = await import(validatorUrl);
  for (const [name, prefix] of [["university", "U"], ["high_school", "H"], ["graduate", "G"]]) {
    const bank = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "banks", `${name}.v5.0.0.json`), "utf8"));
    assert.doesNotThrow(() => validator.validateBank(bank, prefix));
  }
});

test("validator rejects a malformed Q20", async () => {
  const { validateBank } = await import(validatorUrl);
  const bank = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "banks", "university.v5.0.0.json"), "utf8"));
  bank.questions[19].options.pop();
  assert.throws(() => validateBank(bank, "U"), /Q20 requires 16 options/);
});
