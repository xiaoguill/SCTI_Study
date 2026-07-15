const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const validatorUrl = pathToFileURL(path.resolve(__dirname, "..", "scripts", "validate-question-banks.mjs")).href;
const compilerFile = path.resolve(__dirname, "..", "scripts", "compile-question-banks.mjs");
const compilerUrl = pathToFileURL(compilerFile).href;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8"));
}

function validPersonaPresentation() {
  return {
    version: "1.0.0",
    default: {
      character_image: "",
      character_alt: "校园人设角色",
      character_position: "center_bottom",
      character_scale: 1,
      hero_background: "#f7f0e3",
      decorations: [],
      visual_brief: "抽象低多边形纸雕校园角色，浅米色背景与清晰表情。",
      asset_status: "placeholder",
      poster: {
        template_key: "persona-result-v1",
        character_position: "center_bottom",
        safe_area: "center"
      }
    },
    tags: {
      "university:U1": {
        character_image: "/assets/personas/university/u1.webp",
        character_alt: "大学校园角色",
        character_position: "center_bottom",
        character_scale: 1.1,
        hero_background: "#f7f0e3",
        decorations: ["star"],
        visual_brief: "抽象低多边形纸雕大学角色，浅米色背景与星形装饰。",
        asset_status: "draft",
        poster: {
          template_key: "persona-result-v1",
          character_position: "center_bottom",
          safe_area: "center"
        }
      }
    }
  };
}

function activeSourceFiles(relativePath) {
  const target = path.resolve(__dirname, "..", relativePath);
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ["data", "docs", "node_modules", "tests"].includes(entry.name)) return [];
    return activeSourceFiles(path.relative(path.resolve(__dirname, ".."), path.join(target, entry.name)));
  });
}

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

test("persona presentation validator rejects malformed public configuration", async () => {
  const { loadConfiguredData, validatePersonaPresentation } = await import(validatorUrl);
  const valid = validPersonaPresentation();
  assert.doesNotThrow(() => validatePersonaPresentation(valid));

  const cases = [
    ["required keys", (value) => { delete value.tags; }, /requires version, default, and tags/],
    ["version type", (value) => { value.version = ["1.0.0"]; }, /version must be a string/],
    ["semantic version", (value) => { value.version = "v1"; }, /version must be semantic version/],
    ["top-level fields", (value) => { value.private_scores = {}; }, /unsupported top-level field/],
    ["tag key", (value) => { value.tags["university:u1"] = value.tags["university:U1"]; delete value.tags["university:U1"]; }, /invalid presentation tag key/],
    ["entry fields", (value) => { value.tags["university:U1"].tag_name = "不应进入运行时"; }, /unsupported field/],
    ["image root", (value) => { value.tags["university:U1"].character_image = "/assets/private/u1.webp"; }, /character_image/],
    ["image extension", (value) => { value.tags["university:U1"].character_image = "/assets/personas/u1.svg"; }, /character_image/],
    ["image filename", (value) => { value.tags["university:U1"].character_image = "/assets/personas/group/.webp"; }, /character_image/],
    ["duplicate decorations", (value) => { value.tags["university:U1"].decorations = ["star", "star"]; }, /decorations must be unique/],
    ["empty decorations", (value) => { value.tags["university:U1"].decorations = [""]; }, /decorations must be nonempty strings/],
    ["field type", (value) => { value.default.character_alt = 42; }, /character_alt must be a string/],
    ["scale range", (value) => { value.tags["university:U1"].character_scale = 1.6; }, /character_scale/],
    ["hero background", (value) => { value.tags["university:U1"].hero_background = "beige"; }, /hero_background/],
    ["asset status", (value) => { value.tags["university:U1"].asset_status = "published"; }, /asset_status/],
    ["visual brief", (value) => { value.tags["university:U1"].visual_brief = ""; }, /visual_brief/],
    ["poster safe area", (value) => { value.tags["university:U1"].poster.safe_area = ""; }, /poster\.safe_area/]
  ];
  for (const [name, mutate, message] of cases) {
    const malformed = structuredClone(valid);
    mutate(malformed);
    assert.throws(() => validatePersonaPresentation(malformed), message, name);
  }

  const configured = loadConfiguredData();
  assert.deepEqual(configured.presentation, readJson("data/persona-presentation.v1.json"));
  assert.doesNotThrow(() => validatePersonaPresentation(configured.presentation));
});

test("configured presentation covers every enabled canonical bank tag", async () => {
  const { loadConfiguredData, validateConfiguredPresentation } = await import(validatorUrl);
  const configured = loadConfiguredData();
  const incomplete = structuredClone(configured.presentation);
  delete incomplete.tags["graduate:G16"];

  assert.doesNotThrow(() => validateConfiguredPresentation(
    configured.registry,
    configured.banks,
    configured.presentation
  ));
  assert.throws(
    () => validateConfiguredPresentation(configured.registry, configured.banks, incomplete),
    /missing presentation key: graduate:G16/
  );
});

test("configured presentation validates the default image asset", async () => {
  const { loadConfiguredData, validateConfiguredPresentation } = await import(validatorUrl);
  const configured = loadConfiguredData();
  configured.presentation.default.character_image = "/assets/personas/missing-default.png";
  assert.throws(
    () => validateConfiguredPresentation(configured.registry, configured.banks, configured.presentation),
    /default character_image does not exist in miniprogram package: \/assets\/personas\/missing-default\.png/
  );
});

test("every configured tag has unique Chinese alt text and a tag-specific visual brief", () => {
  const configured = readJson("data/persona-presentation.v1.json");
  const briefs = [];
  for (const version of ["high_school", "university", "graduate"]) {
    const bank = readJson(`data/banks/${version}.v5.0.0.json`);
    for (const tag of bank.tags) {
      const entry = configured.tags[`${version}:${tag.id}`];
      assert.ok(entry.character_alt.includes(tag.name), `${version}:${tag.id} alt must name ${tag.name}`);
      assert.ok(/[\u3400-\u9fff]/.test(entry.character_alt), `${version}:${tag.id} alt must be Chinese`);
      assert.ok(entry.visual_brief.includes(tag.name), `${version}:${tag.id} brief must name ${tag.name}`);
      assert.ok(entry.visual_brief.includes("低多边形") && entry.visual_brief.includes("浅米色"), `${version}:${tag.id} brief must keep the shared art direction`);
      briefs.push(entry.visual_brief);
    }
  }
  assert.equal(new Set(briefs).size, 48);
});

test("persona presentation schema mirrors the public validation boundary", () => {
  const schema = readJson("schemas/persona-presentation.schema.json");
  assert.deepEqual(schema.required, ["version", "default", "tags"]);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.tags.propertyNames.pattern, "^[a-z][a-z0-9_]*:[A-Z][A-Z0-9]{0,7}$");
  assert.equal(schema.properties.default.$ref, "#/$defs/completePresentation");
  assert.equal(schema.properties.tags.additionalProperties.$ref, "#/$defs/presentationOverride");
  const override = schema.$defs.presentationOverride;
  assert.equal(override.additionalProperties, false);
  assert.deepEqual(schema.$defs.completePresentation.required, [
    "character_image", "character_alt", "character_position", "character_scale", "hero_background",
    "decorations", "visual_brief", "asset_status", "poster"
  ]);
  assert.deepEqual(schema.$defs.completePoster.required, ["template_key", "character_position", "safe_area"]);
  assert.equal(override.properties.decorations.uniqueItems, true);
  assert.equal(override.properties.decorations.items.minLength, 1);
  assert.deepEqual(override.properties.character_scale, { type: "number", minimum: 0.5, maximum: 1.5 });
  assert.equal(override.properties.hero_background.pattern, "^#[0-9a-fA-F]{6}$");
  assert.equal(override.properties.visual_brief.minLength, 1);
  assert.equal(override.properties.visual_brief.pattern, "\\S");
  assert.deepEqual(override.properties.asset_status.enum, ["placeholder", "draft", "approved"]);
  assert.equal(schema.$defs.posterOverride.properties.template_key.pattern, "\\S");
  assert.deepEqual(schema.$defs.posterOverride.properties.character_position.enum, ["center_bottom", "center", "left_bottom", "right_bottom"]);
  assert.equal(schema.$defs.posterOverride.properties.safe_area.pattern, "\\S");
  const imagePattern = new RegExp(override.properties.character_image.pattern);
  assert.equal(imagePattern.test(""), true);
  assert.equal(imagePattern.test("/assets/personas/example.webp"), true);
  assert.equal(imagePattern.test("/assets/private/example.webp"), false);
  assert.equal(imagePattern.test("/assets/personas/example.svg"), false);
  assert.equal(imagePattern.test("/assets/personas/group/.webp"), false);
});

test("complete default presentation rejects every missing required field", async () => {
  const { validatePersonaPresentation } = await import(validatorUrl);
  const required = [
    "character_image", "character_alt", "character_position", "character_scale", "hero_background",
    "decorations", "visual_brief", "asset_status", "poster"
  ];
  for (const field of required) {
    const malformed = validPersonaPresentation();
    delete malformed.default[field];
    assert.throws(() => validatePersonaPresentation(malformed), new RegExp(`default presentation requires ${field}`), field);
  }
  const missingPosterPosition = validPersonaPresentation();
  delete missingPosterPosition.default.poster.character_position;
  assert.throws(() => validatePersonaPresentation(missingPosterPosition), /default poster\.character_position is required/);
});

test("every enabled version resolves to one canonical bank and algorithm profile", async () => {
  const { validateRegistry, validateAlgorithmProfile } = await import(validatorUrl);
  const registry = readJson("data/quiz-versions.v1.json");
  const profile = readJson("data/algorithms/three-layer.v2.0.0.json");
  const profiles = { [profile.id]: profile };
  const banks = Object.fromEntries(["high_school", "university", "graduate"].map((id) => [id, readJson(`data/banks/${id}.v5.0.0.json`)]));

  assert.doesNotThrow(() => validateAlgorithmProfile(profile));
  assert.doesNotThrow(() => validateRegistry(registry, banks, profiles));
  assert.deepEqual(registry.versions.filter((item) => item.enabled).map((item) => item.id), ["high_school", "university", "graduate"]);
  for (const bank of Object.values(banks)) assert.equal(bank.algorithm_profile, profile.id);
});

test("algorithm profile validator requires every runtime section", async () => {
  const { validateAlgorithmProfile } = await import(validatorUrl);
  const profile = readJson("data/algorithms/three-layer.v2.0.0.json");
  for (const [section, message] of [
    ["main_result", /algorithm profile main_result is required/],
    ["core", /algorithm profile core is required/],
    ["dimension", /algorithm profile dimension is required/]
  ]) {
    const malformed = structuredClone(profile);
    delete malformed[section];
    assert.throws(() => validateAlgorithmProfile(malformed), message);
  }
});

test("algorithm profile validator rejects malformed exclusions and tunables", async () => {
  const { validateAlgorithmProfile } = await import(validatorUrl);
  const profile = readJson("data/algorithms/three-layer.v2.0.0.json");
  const cases = [
    ["exclusions must include Q20", (value) => { value.main_result.excluded_question_ids = [19]; }, /must include Q20/],
    ["exclusions must be unique", (value) => { value.main_result.excluded_question_ids = [20, 20]; }, /must be unique/],
    ["exclusions must be integer IDs", (value) => { value.main_result.excluded_question_ids = [20, 1.5]; }, /integer question IDs/],
    ["exclusions must be valid IDs", (value) => { value.main_result.excluded_question_ids = [20, 21]; }, /between 1 and 20/],
    ["minimum projected questions must be positive", (value) => { value.core.minimum_projected_questions = 0; }, /core.minimum_projected_questions/],
    ["unique match must be boolean", (value) => { value.core.require_unique_match = "yes"; }, /core.require_unique_match/],
    ["core score gap must be finite", (value) => { value.core.max_score_gap_from_leader = Number.POSITIVE_INFINITY; }, /core.max_score_gap_from_leader/],
    ["score lead must be finite", (value) => { value.score.minimum_lead = Number.NaN; }, /score.minimum_lead/],
    ["dimension metric must be supported", (value) => { value.dimension.metric = "euclidean"; }, /dimension.metric/],
    ["precision must be an integer", (value) => { value.dimension.precision = 1.5; }, /dimension.precision/],
    ["precision must be bounded", (value) => { value.dimension.precision = 101; }, /dimension.precision/],
    ["candidate score gap must be nonnegative", (value) => { value.dimension.candidate_score_gap = -1; }, /dimension.candidate_score_gap/]
  ];

  for (const [name, mutate, message] of cases) {
    const malformed = structuredClone(profile);
    mutate(malformed);
    assert.throws(() => validateAlgorithmProfile(malformed), message, name);
  }
});

test("algorithm profile schema keeps runtime tunables typed instead of constant", () => {
  const schema = readJson("schemas/algorithm-profile.schema.json");
  const tunables = [
    [schema.properties.core.properties.minimum_projected_questions, "integer"],
    [schema.properties.core.properties.require_unique_match, "boolean"],
    [schema.properties.core.properties.max_score_gap_from_leader, "integer"],
    [schema.properties.score.properties.minimum_lead, "integer"],
    [schema.properties.dimension.properties.precision, "integer"],
    [schema.properties.dimension.properties.candidate_score_gap, "integer"]
  ];
  for (const [property, type] of tunables) {
    assert.equal(property.type, type);
    assert.equal("const" in property, false);
  }
  const exclusions = schema.properties.main_result.properties.excluded_question_ids;
  assert.equal(exclusions.uniqueItems, true);
  assert.deepEqual(exclusions.contains, { const: 20 });
});

test("registry validator enforces dynamic version identity and uniqueness contracts", async () => {
  const { validateRegistry } = await import(validatorUrl);
  const sourceRegistry = readJson("data/quiz-versions.v1.json");
  const profile = readJson("data/algorithms/three-layer.v2.0.0.json");
  const profiles = { [profile.id]: profile };
  const sourceBanks = Object.fromEntries(sourceRegistry.versions.map((item) => [item.id, readJson(`data/banks/${item.id}.v${item.bank_version}.json`)]));
  const validRegistry = structuredClone(sourceRegistry);
  for (const item of validRegistry.versions) item.tag_prefix = sourceBanks[item.id].tags[0].prefix;
  const cases = [
    ["order", (registry) => { registry.versions[1].order = registry.versions[0].order; }, /orders must be unique/],
    ["cache namespace", (registry) => { registry.versions[1].cache_namespace = registry.versions[0].cache_namespace; }, /cache namespaces must be unique/],
    ["public filename", (registry) => { registry.versions[1].public_bank_file = registry.versions[0].public_bank_file; }, /public bank files must be unique/],
    ["filename convention", (registry) => { registry.versions[0].public_bank_file = "wrong.v5.0.0.public.json"; }, /public bank file must equal/],
    ["tag prefix", (registry) => { delete registry.versions[0].tag_prefix; }, /tag_prefix/],
    ["default present", (registry) => { registry.default_version = "missing_version"; }, /default version must be present and enabled/],
    ["default enabled", (registry) => { registry.versions.find((item) => item.id === registry.default_version).enabled = false; }, /default version must be present and enabled/]
  ];
  for (const [name, mutate, message] of cases) {
    const registry = structuredClone(validRegistry);
    mutate(registry);
    assert.throws(() => validateRegistry(registry, sourceBanks, profiles), message, name);
  }

  const mismatchedBanks = structuredClone(sourceBanks);
  mismatchedBanks.high_school.version = "wrong_version";
  assert.throws(() => validateRegistry(validRegistry, mismatchedBanks, profiles), /bank identity mismatch/);
});

test("registry and bank schemas allow safe data-driven version identifiers", () => {
  const registrySchema = readJson("schemas/quiz-version-registry.schema.json");
  const versionSchema = registrySchema.$defs.version;
  assert.equal(versionSchema.properties.id.type, "string");
  assert.equal(versionSchema.properties.bank_version.type, "string");
  assert.ok(versionSchema.required.includes("tag_prefix"));
  assert.equal(versionSchema.properties.tag_prefix.pattern, "^[A-Z][A-Z0-9]{0,7}$");
  assert.equal(registrySchema.properties.default_version.type, "string");

  const bankSchema = readJson("schemas/question-bank.schema.json");
  assert.equal(bankSchema.properties.version.type, "string");
  assert.equal(bankSchema.properties.bank_version.type, "string");
  assert.equal(bankSchema.$defs.tag.properties.id.pattern, "^[A-Z][A-Z0-9]{0,7}(?:[1-9]|1[0-6])$");
});

test("Q20 is self perception only in all canonical banks", () => {
  for (const id of ["high_school", "university", "graduate"]) {
    const bank = readJson(`data/banks/${id}.v5.0.0.json`);
    assert.equal(bank.questions.find((question) => question.id === 20).result_effect, "self_perception_only");
  }
});

test("Markdown compiler safely plans three valid profile-bound banks without writing", async () => {
  const compilerSource = fs.readFileSync(compilerFile, "utf8");
  assert.match(compilerSource, /export function compileQuestionBanks/);
  assert.match(compilerSource, /process\.argv\[1\].*fileURLToPath/);

  const canonicalFiles = ["high_school", "university", "graduate"]
    .map((id) => path.resolve(__dirname, "..", "data", "banks", `${id}.v5.0.0.json`));
  const before = canonicalFiles.map((file) => fs.readFileSync(file, "utf8"));
  const { validateAlgorithmProfile, validateBank } = await import(validatorUrl);
  const { compileQuestionBanks } = await import(`${compilerUrl}?safe-compile=${Date.now()}`);
  const { banks, profiles } = compileQuestionBanks({ write: false });

  assert.deepEqual(banks.map((bank) => bank.version).sort(), ["graduate", "high_school", "university"]);
  for (const bank of banks) {
    const profile = profiles[bank.algorithm_profile];
    assert.ok(profile, `${bank.version} must reference a compiled algorithm profile`);
    assert.doesNotThrow(() => validateAlgorithmProfile(profile));
    assert.doesNotThrow(() => validateBank(bank, bank.tags[0].prefix));
    assert.equal(bank.questions.find((question) => question.id === 20).result_effect, "self_perception_only");
  }
  assert.deepEqual(canonicalFiles.map((file) => fs.readFileSync(file, "utf8")), before);
});

test("legacy university-only bank paths are absent from active sources", () => {
  const legacyFiles = [
    "campus_persona/data/university-bank.json",
    "campus_persona/cloudfunctions/get-bank/university-bank.public.json",
    "campus_persona/cloudfunctions/submit-quiz/university-bank.json",
    "frontend-demo/data/university-bank.public.json",
    "campus_persona/scripts/build-university-bank.mjs"
  ];
  const existingLegacyFiles = legacyFiles.filter((relativePath) => fs.existsSync(path.resolve(__dirname, "..", relativePath)));
  assert.deepEqual(existingLegacyFiles, [], `stale university-only files remain: ${existingLegacyFiles.join(", ")}`);

  const sourceFiles = [
    ...activeSourceFiles("scripts"),
    ...activeSourceFiles("campus_persona/package.json"),
    ...activeSourceFiles("campus_persona/scripts"),
    ...activeSourceFiles("campus_persona/cloudfunctions"),
    ...activeSourceFiles("frontend-demo")
  ].filter((file) => /\.(?:c?js|mjs|json|html)$/.test(file));
  const legacyReference = /(?:university-bank(?:\.public)?\.json|build-university-bank\.mjs)/;
  const offenders = sourceFiles
    .filter((file) => legacyReference.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(path.resolve(__dirname, ".."), file).replaceAll("\\", "/"));
  assert.deepEqual(offenders, [], `active sources still reference legacy university-only files: ${offenders.join(", ")}`);
});
