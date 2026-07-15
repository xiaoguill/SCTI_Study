const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readCanonicalJson(...segments) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", ...segments), "utf8"));
}

function renamedBank(bank, version, tagPrefix) {
  const clone = structuredClone(bank);
  const rename = (tagId) => `${tagPrefix}${tagId.match(/\d+$/)[0]}`;
  clone.version = version;
  for (const tag of clone.tags) {
    tag.id = rename(tag.id);
    tag.prefix = tagPrefix;
  }
  for (const question of clone.questions) for (const option of question.options) {
    option.scores = Object.fromEntries(Object.entries(option.scores).map(([tagId, score]) => [rename(tagId), score]));
  }
  return clone;
}

test("public banks expose questions but no private scoring data", async () => {
  const { createPublicBank } = await import("../scripts/build-question-banks.mjs");
  const bank = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "data", "banks", "university.v5.0.0.json"), "utf8"));
  const publicBank = createPublicBank(bank);

  assert.equal(publicBank.version, "university");
  assert.equal(publicBank.questions.length, 20);
  assert.equal(publicBank.questions[19].result_effect, "self_perception_only");
  assert.equal("tags" in publicBank, false);
  for (const question of publicBank.questions) for (const option of question.options) {
    assert.equal("scores" in option, false);
    assert.equal("dimensions" in option, false);
  }
});

test("one build writes all three versions to every runtime target", async () => {
  const { buildQuestionBanks } = await import("../scripts/build-question-banks.mjs");
  const written = buildQuestionBanks({ write: false });
  const targets = written.map((item) => item.target.replaceAll("\\", "/"));
  for (const id of ["high_school", "university", "graduate"]) {
    assert.ok(targets.some((target) => target.endsWith(`frontend-demo/data/${id}.v5.0.0.public.json`)));
    assert.ok(targets.some((target) => target.endsWith(`get-bank/data/${id}.v5.0.0.public.json`)));
    assert.ok(targets.some((target) => target.endsWith(`submit-quiz/data/banks/${id}.v5.0.0.json`)));
  }
});

test("native runtime contains every enabled public bank and no private scoring data", async () => {
  const { buildQuestionBanks, createNativeRuntimeModule } = await import("../scripts/build-question-banks.mjs");
  const presentation = readCanonicalJson("data", "persona-presentation.v1.json");
  const artifacts = buildQuestionBanks({ write: false });
  const native = artifacts.find(({ target }) => target.replaceAll("\\", "/").endsWith("miniprogram/data/runtime.js"));
  assert.ok(native);
  assert.equal(typeof native.value, "string");

  const module = { exports: {} };
  Function("module", "exports", native.value)(module, module.exports);
  const runtime = module.exports;
  assert.deepEqual(
    runtime.registry.versions.filter(({ enabled }) => enabled).map(({ id }) => id),
    ["high_school", "university", "graduate"]
  );
  assert.deepEqual(runtime.presentation, presentation);
  for (const bank of Object.values(runtime.banks)) {
    assert.equal("tags" in bank, false);
    for (const question of bank.questions) for (const option of question.options) {
      assert.equal("scores" in option, false);
      assert.equal("dimensions" in option, false);
    }
  }
  assert.doesNotMatch(
    createNativeRuntimeModule(runtime.registry, runtime.banks, runtime.presentation),
    /scores_ranking|target_vector|core_questions|algorithm_profile/
  );
  assert.match(native.value, /\/assets\/personas\/graduate\/g2\.png/);
  assert.ok(fs.existsSync(path.resolve(__dirname, "../../miniprogram/assets/personas/graduate/g2.png")));
});

test("build rejects malformed presentation before planning runtime artifacts", async () => {
  const { buildQuestionBanks } = await import("../scripts/build-question-banks.mjs");
  const presentation = readCanonicalJson("data", "persona-presentation.v1.json");
  presentation.default.character_image = "/assets/private/character.webp";

  assert.throws(
    () => buildQuestionBanks({ write: false, presentation }),
    /character_image must be empty or a .png\/.webp path under \/assets\/personas\//
  );
});

test("build rejects a non-string presentation version before planning runtime artifacts", async () => {
  const { buildQuestionBanks } = await import("../scripts/build-question-banks.mjs");
  const presentation = readCanonicalJson("data", "persona-presentation.v1.json");
  presentation.version = ["1.0.0"];

  assert.throws(
    () => buildQuestionBanks({ write: false, presentation }),
    /version must be a string/
  );
});

test("build rejects a missing default presentation image before planning runtime artifacts", async () => {
  const { buildQuestionBanks } = await import("../scripts/build-question-banks.mjs");
  const presentation = readCanonicalJson("data", "persona-presentation.v1.json");
  presentation.default.character_image = "/assets/personas/missing-default.png";

  assert.throws(
    () => buildQuestionBanks({ write: false, presentation }),
    /default character_image does not exist in miniprogram package: \/assets\/personas\/missing-default\.png/
  );
});

test("a data-only fourth version validates and plans every runtime artifact", async () => {
  const { buildQuestionBanks } = await import("../scripts/build-question-banks.mjs");
  const validator = await import("../../scripts/validate-question-banks.mjs");
  assert.equal(typeof validator.validateConfiguredBanks, "function");

  const registry = readCanonicalJson("data", "quiz-versions.v1.json");
  const profile = readCanonicalJson("data", "algorithms", "three-layer.v2.0.0.json");
  const banks = Object.fromEntries(registry.versions.map((item) => {
    const bank = readCanonicalJson("data", "banks", `${item.id}.v${item.bank_version}.json`);
    item.tag_prefix = bank.tags[0].prefix;
    return [item.id, bank];
  }));
  const fourthId = "continuing_education";
  const fourthBank = renamedBank(banks.university, fourthId, "C");
  const university = registry.versions.find((item) => item.id === "university");
  registry.versions.push({
    ...structuredClone(university),
    id: fourthId,
    order: 4,
    tag_prefix: "C",
    cache_namespace: "campus-persona-continuing-education",
    public_bank_file: `${fourthId}.v${fourthBank.bank_version}.public.json`
  });
  banks[fourthId] = fourthBank;
  const profiles = { [profile.id]: profile };
  const presentation = readCanonicalJson("data", "persona-presentation.v1.json");
  presentation.tags = Object.fromEntries(Object.entries(banks).flatMap(([versionId, bank]) => bank.tags.map((tag) => [
    `${versionId}:${tag.id}`,
    { ...structuredClone(presentation.default), character_alt: `${versionId}:${tag.id}` }
  ])));

  assert.doesNotThrow(() => validator.validateConfiguredBanks(registry, banks, profiles));
  const artifacts = buildQuestionBanks({ write: false, registry, banks, profiles, presentation });
  const targets = artifacts.map(({ target }) => target.replaceAll("\\", "/"));
  assert.ok(targets.some((target) => target.endsWith(`frontend-demo/data/${fourthId}.v5.0.0.public.json`)));
  assert.ok(targets.some((target) => target.endsWith(`get-bank/data/${fourthId}.v5.0.0.public.json`)));
  assert.ok(targets.some((target) => target.endsWith(`submit-quiz/data/banks/${fourthId}.v5.0.0.json`)));
});
