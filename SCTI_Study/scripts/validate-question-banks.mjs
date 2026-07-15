import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = (bank, message) => { throw new Error(`[${bank.version}] ${message}`); };
const exactSignature = (core) => core.map(({ qid, option_id }) => `${qid}:${option_id}`).sort().join("|");
const VERSION_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const TAG_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{0,7}$/;
const CACHE_NAMESPACE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_BANK_FILE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.v\d+\.\d+\.\d+\.public\.json$/;
const PRESENTATION_TAG_KEY_PATTERN = /^[a-z][a-z0-9_]*:[A-Z][A-Z0-9]{0,7}$/;
const PERSONA_IMAGE_PATTERN = /^\/assets\/personas\/[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)*\.(?:png|webp)$/;
const PRESENTATION_FIELDS = new Set([
  "character_image",
  "character_alt",
  "character_position",
  "character_scale",
  "hero_background",
  "decorations",
  "visual_brief",
  "asset_status",
  "poster"
]);
const PRESENTATION_REQUIRED_FIELDS = [...PRESENTATION_FIELDS];
const CHARACTER_POSITIONS = new Set(["center_bottom", "center", "left_bottom", "right_bottom"]);
const SUPPORTED_DECORATIONS = new Set(["star", "sparkle", "leaf"]);
const ASSET_STATUSES = new Set(["placeholder", "draft", "approved"]);
const POSTER_SAFE_AREAS = new Set(["center", "inset"]);

function requireSection(profile, section) {
  const value = profile?.[section];
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`algorithm profile ${section} is required`);
  return value;
}

function requireInteger(value, name, minimum, maximum = Number.POSITIVE_INFINITY) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum || value > maximum) {
    const range = Number.isFinite(maximum) ? `between ${minimum} and ${maximum}` : `at least ${minimum}`;
    throw new Error(`${name} must be an integer ${range}`);
  }
}

export function validateAlgorithmProfile(profile) {
  if (!/^three-layer\.v\d+\.\d+\.\d+$/.test(profile?.id || "")) throw new Error("invalid algorithm profile id");
  if (profile.strategy !== "three_layer") throw new Error("unsupported algorithm strategy");
  if (profile.scored_effect !== "scored") throw new Error("scored_effect must be scored");

  const mainResult = requireSection(profile, "main_result");
  const exclusions = mainResult.excluded_question_ids;
  if (!Array.isArray(exclusions)) throw new Error("main_result.excluded_question_ids must be an array of integer question IDs");
  if (exclusions.some((id) => !Number.isFinite(id) || !Number.isInteger(id))) throw new Error("main_result.excluded_question_ids must contain integer question IDs");
  if (exclusions.some((id) => id < 1 || id > 20)) throw new Error("main_result.excluded_question_ids must be between 1 and 20");
  if (new Set(exclusions).size !== exclusions.length) throw new Error("main_result.excluded_question_ids must be unique");
  if (!exclusions.includes(20)) throw new Error("main_result.excluded_question_ids must include Q20");

  const core = requireSection(profile, "core");
  requireInteger(core.minimum_projected_questions, "core.minimum_projected_questions", 1, 3);
  if (typeof core.require_unique_match !== "boolean") throw new Error("core.require_unique_match must be boolean");
  requireInteger(core.max_score_gap_from_leader, "core.max_score_gap_from_leader", 0);

  const score = requireSection(profile, "score");
  requireInteger(score.minimum_lead, "score.minimum_lead", 1);

  const dimension = requireSection(profile, "dimension");
  if (dimension.metric !== "manhattan") throw new Error("dimension.metric must be manhattan");
  requireInteger(dimension.precision, "dimension.precision", 0, 100);
  requireInteger(dimension.candidate_score_gap, "dimension.candidate_score_gap", 0);

  const selfPerception = requireSection(profile, "self_perception");
  if (selfPerception.question_id !== 20 || selfPerception.role !== "self_perception_only") throw new Error("Q20 must be self_perception_only");
}

export function validateRegistry(registry, banks, profiles) {
  if (!registry || !Array.isArray(registry.versions) || registry.versions.length === 0) throw new Error("registry versions must be a nonempty array");
  const versions = registry.versions;
  const uniqueFields = [
    ["id", "version ids"],
    ["order", "orders"],
    ["cache_namespace", "cache namespaces"],
    ["public_bank_file", "public bank files"]
  ];
  for (const [field, label] of uniqueFields) {
    const values = versions.map((item) => item[field]);
    if (new Set(values).size !== values.length) throw new Error(`registry ${label} must be unique`);
  }

  for (const item of versions) {
    if (!VERSION_ID_PATTERN.test(item.id || "")) throw new Error("registry version id is invalid");
    if (typeof item.enabled !== "boolean") throw new Error(`registry enabled must be boolean: ${item.id}`);
    requireInteger(item.order, `registry order for ${item.id}`, 1);
    if (!SEMVER_PATTERN.test(item.bank_version || "")) throw new Error(`registry bank_version is invalid: ${item.id}`);
    if (!TAG_PREFIX_PATTERN.test(item.tag_prefix || "")) throw new Error(`registry tag_prefix is invalid: ${item.id}`);
    if (!CACHE_NAMESPACE_PATTERN.test(item.cache_namespace || "")) throw new Error(`registry cache_namespace is invalid: ${item.id}`);
    if (!PUBLIC_BANK_FILE_PATTERN.test(item.public_bank_file || "")) throw new Error(`registry public_bank_file is invalid: ${item.id}`);
    const expectedPublicFile = `${item.id}.v${item.bank_version}.public.json`;
    if (item.public_bank_file !== expectedPublicFile) throw new Error(`public bank file must equal ${expectedPublicFile}`);
  }

  const defaultVersion = versions.find((item) => item.id === registry.default_version);
  if (!defaultVersion?.enabled) throw new Error("registry default version must be present and enabled");

  const enabled = versions.filter((item) => item.enabled);
  for (const item of enabled) {
    const bank = banks[item.id];
    if (!bank) throw new Error(`registry bank missing: ${item.id}`);
    if (bank.version !== item.id) throw new Error(`bank identity mismatch: ${item.id}`);
    if (bank.bank_version !== item.bank_version) throw new Error(`bank version mismatch: ${item.id}`);
    const profile = profiles[bank.algorithm_profile];
    if (!profile) throw new Error(`algorithm profile missing: ${item.id}`);
    validateAlgorithmProfile(profile);
  }
}

export function validateConfiguredBanks(registry, banks, profiles) {
  validateRegistry(registry, banks, profiles);
  const enabled = registry.versions.filter((item) => item.enabled);
  for (const item of enabled) validateBank(banks[item.id], item.tag_prefix);
  return enabled;
}

function validatePresentationEntry(entry, name, requireAll = false) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${name} presentation must be an object`);
  for (const field of requireAll ? PRESENTATION_REQUIRED_FIELDS : []) {
    if (!(field in entry)) throw new Error(`${name} presentation requires ${field}`);
  }
  for (const field of Object.keys(entry)) {
    if (!PRESENTATION_FIELDS.has(field)) throw new Error(`${name} presentation has unsupported field: ${field}`);
  }
  if ("character_image" in entry) {
    const image = entry.character_image;
    if (typeof image !== "string" || (image !== "" && (!PERSONA_IMAGE_PATTERN.test(image) || image.includes("//")))) {
      throw new Error(`${name} character_image must be empty or a .png/.webp path under /assets/personas/`);
    }
  }
  if ("character_alt" in entry && typeof entry.character_alt !== "string") throw new Error(`${name} character_alt must be a string`);
  if ("character_position" in entry && !CHARACTER_POSITIONS.has(entry.character_position)) throw new Error(`${name} character_position must be a supported native position`);
  if ("character_scale" in entry && (!Number.isFinite(entry.character_scale) || entry.character_scale < 0.5 || entry.character_scale > 1.5)) {
    throw new Error(`${name} character_scale must be between 0.5 and 1.5`);
  }
  if ("hero_background" in entry && (typeof entry.hero_background !== "string" || !/^#[0-9a-fA-F]{6}$/.test(entry.hero_background))) {
    throw new Error(`${name} hero_background must be a #RRGGBB color`);
  }
  if ("decorations" in entry && !Array.isArray(entry.decorations)) throw new Error(`${name} decorations must be an array`);
  if (entry.decorations?.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${name} decorations must be nonempty strings`);
  }
  if (entry.decorations?.some((item) => !SUPPORTED_DECORATIONS.has(item))) {
    throw new Error(`${name} decorations must use supported native decoration names`);
  }
  if (entry.decorations && new Set(entry.decorations).size !== entry.decorations.length) throw new Error(`${name} decorations must be unique`);
  if ("visual_brief" in entry && (typeof entry.visual_brief !== "string" || entry.visual_brief.trim() === "")) throw new Error(`${name} visual_brief must be a nonempty string`);
  if ("asset_status" in entry && !ASSET_STATUSES.has(entry.asset_status)) throw new Error(`${name} asset_status must be placeholder, draft, or approved`);
  if ("poster" in entry && (!entry.poster || typeof entry.poster !== "object" || Array.isArray(entry.poster))) throw new Error(`${name} poster must be an object`);
  if (!("poster" in entry)) return;
  if (Object.keys(entry.poster).some((field) => !["template_key", "character_position", "safe_area"].includes(field))) throw new Error(`${name} poster has unsupported field`);
  for (const field of requireAll ? ["template_key", "character_position", "safe_area"] : []) {
    if (!(field in entry.poster)) throw new Error(`${name} poster.${field} is required`);
  }
  if ("template_key" in entry.poster && (typeof entry.poster.template_key !== "string" || entry.poster.template_key.trim() === "")) throw new Error(`${name} poster.template_key must be a nonempty string`);
  if ("character_position" in entry.poster && !CHARACTER_POSITIONS.has(entry.poster.character_position)) throw new Error(`${name} poster.character_position must be a supported native position`);
  if ("safe_area" in entry.poster && (typeof entry.poster.safe_area !== "string" || entry.poster.safe_area.trim() === "" || !POSTER_SAFE_AREAS.has(entry.poster.safe_area))) throw new Error(`${name} poster.safe_area must be a supported safe area`);
}

export function validatePersonaPresentation(presentation) {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) throw new Error("persona presentation must be an object");
  if (!["version", "default", "tags"].every((field) => field in presentation)) {
    throw new Error("persona presentation requires version, default, and tags");
  }
  for (const field of Object.keys(presentation)) {
    if (!["version", "default", "tags"].includes(field)) throw new Error(`persona presentation has unsupported top-level field: ${field}`);
  }
  if (typeof presentation.version !== "string") throw new Error("persona presentation version must be a string");
  if (!SEMVER_PATTERN.test(presentation.version || "")) throw new Error("persona presentation version must be semantic version");
  validatePresentationEntry(presentation.default, "default", true);
  if (!presentation.tags || typeof presentation.tags !== "object" || Array.isArray(presentation.tags)) {
    throw new Error("persona presentation tags must be an object");
  }
  for (const [key, entry] of Object.entries(presentation.tags)) {
    if (!PRESENTATION_TAG_KEY_PATTERN.test(key)) throw new Error(`invalid presentation tag key: ${key}`);
    validatePresentationEntry(entry, key);
  }
}

export function validateConfiguredPresentation(registry, banks, presentation) {
  validatePersonaPresentation(presentation);
  const enabled = registry?.versions?.filter((item) => item.enabled) || [];
  const expectedKeys = enabled.flatMap((version) => {
    const bank = banks?.[version.id];
    if (!bank) throw new Error(`presentation bank missing: ${version.id}`);
    return bank.tags.map((tag) => `${version.id}:${tag.id}`);
  });
  const configuredKeys = Object.keys(presentation.tags);
  for (const key of expectedKeys) {
    if (!Object.hasOwn(presentation.tags, key)) throw new Error(`missing presentation key: ${key}`);
  }
  for (const key of configuredKeys) {
    if (!expectedKeys.includes(key)) throw new Error(`extra presentation key: ${key}`);
  }
  for (const [key, entry] of [["default", presentation.default], ...Object.entries(presentation.tags)]) {
    if (!entry.character_image) continue;
    const assetFile = path.join(root, "miniprogram", entry.character_image.replace(/^\//, ""));
    if (!fs.existsSync(assetFile) || !fs.statSync(assetFile).isFile()) {
      throw new Error(`${key} character_image does not exist in miniprogram package: ${entry.character_image}`);
    }
  }
}

export function validateBank(bank, expectedPrefix) {
  if (!bank || typeof bank !== "object") throw new Error("bank must be an object");
  if (!VERSION_ID_PATTERN.test(bank.version || "")) fail(bank, "version id is invalid");
  if (!SEMVER_PATTERN.test(bank.bank_version || "")) fail(bank, "bank_version must be semantic version");
  if (!TAG_PREFIX_PATTERN.test(expectedPrefix || "")) fail(bank, "expected tag prefix is invalid");
  if (typeof bank.algorithm_profile !== "string" || !bank.algorithm_profile) fail(bank, "requires algorithm_profile");
  if (!Array.isArray(bank.dimension_config?.labels) || bank.dimension_config.labels.length !== 4) fail(bank, "requires four dimension labels");
  if (!Array.isArray(bank.tags) || bank.tags.length !== 16) fail(bank, "requires exactly 16 tags");
  if (!Array.isArray(bank.questions) || bank.questions.length !== 20) fail(bank, "requires exactly 20 questions");
  const q20s = bank.questions.filter((question) => question.id === 20);
  if (q20s.length !== 1 || q20s[0].result_effect !== "self_perception_only") fail(bank, "requires exactly one Q20 with self_perception_only");
  const tagIds = new Set();
  for (const tag of bank.tags) {
    if (!new RegExp(`^${expectedPrefix}(?:[1-9]|1[0-6])$`).test(tag.id)) fail(bank, `tag ${tag.id} has invalid ${expectedPrefix} prefix`);
    if (tag.prefix !== expectedPrefix) fail(bank, `tag ${tag.id} prefix metadata must be ${expectedPrefix}`);
    if (tagIds.has(tag.id)) fail(bank, `duplicate tag ${tag.id}`);
    tagIds.add(tag.id);
    if (!Array.isArray(tag.dimensions) || tag.dimensions.length !== 4 || tag.dimensions.some((value) => !Number.isInteger(value) || value < 1 || value > 5)) fail(bank, `tag ${tag.id} has invalid dimensions`);
    if (!Array.isArray(tag.core_questions) || tag.core_questions.length < 2 || tag.core_questions.length > 3) fail(bank, `tag ${tag.id} needs 2-3 core questions`);
    if (!tag.full_desc || !["paragraph_1", "paragraph_2", "paragraph_3"].every((field) => typeof tag.full_desc[field] === "string" && tag.full_desc[field].length >= 16 && tag.full_desc[field].length <= 240)) fail(bank, `tag ${tag.id} result copy must be 16-240 chars per paragraph`);
    if (typeof tag.share_copy !== "string" || tag.share_copy.length < 16 || tag.share_copy.length > 100) fail(bank, `tag ${tag.id} share copy must be 16-100 chars`);
  }
  const questionById = new Map(bank.questions.map((question) => [question.id, question]));
  for (const question of bank.questions) {
    if (!Number.isInteger(question.id) || question.id < 1 || question.id > 20) fail(bank, `invalid question id ${question.id}`);
    const expectedOptions = question.id === 20 ? 16 : 4;
    if (!Array.isArray(question.options) || question.options.length !== expectedOptions) fail(bank, `Q${question.id} requires ${expectedOptions} options`);
    for (const option of question.options) {
      if (!/^[A-P]$/.test(option.id)) fail(bank, `Q${question.id} has invalid option id ${option.id}`);
      if (!Array.isArray(option.dimensions) || option.dimensions.length !== 4 || option.dimensions.some((value) => typeof value !== "number" || value < 1 || value > 5)) fail(bank, `Q${question.id}${option.id} has invalid dimensions`);
      for (const [tagId, score] of Object.entries(option.scores || {})) {
        if (!tagIds.has(tagId) || !Number.isInteger(score) || score < 0 || score > 2) fail(bank, `Q${question.id}${option.id} has invalid weight for ${tagId}`);
      }
      if (question.result_effect === "egg_only" && typeof option.easter_egg !== "string") fail(bank, `Q${question.id}${option.id} is egg_only but lacks easter_egg`);
    }
  }
  const coreByTag = new Map();
  for (const tag of bank.tags) {
    for (const core of tag.core_questions) {
      const question = questionById.get(core.qid);
      if (!question?.options.some((option) => option.id === core.option_id)) fail(bank, `tag ${tag.id} references invalid core Q${core.qid}${core.option_id}`);
    }
    const signature = exactSignature(tag.core_questions);
    if (coreByTag.has(signature)) fail(bank, `core collision: ${tag.id} and ${coreByTag.get(signature).id} share ${signature}`);
    coreByTag.set(signature, tag);
  }
  const tags = [...coreByTag.values()];
  for (let left = 0; left < tags.length; left += 1) for (let right = left + 1; right < tags.length; right += 1) {
    const a = new Map(tags[left].core_questions.map((core) => [core.qid, core.option_id]));
    const b = new Map(tags[right].core_questions.map((core) => [core.qid, core.option_id]));
    const conflict = [...a].some(([qid, optionId]) => b.has(qid) && b.get(qid) !== optionId);
    if (!conflict) fail(bank, `core ambiguity: ${tags[left].id} and ${tags[right].id} can both be exactly matched`);
  }
  const eggQuestions = bank.questions.filter((question) => question.result_effect === "egg_only");
  if (!Array.isArray(bank.easter_eggs) || eggQuestions.length !== bank.easter_eggs.length) fail(bank, "egg_only questions and easter_eggs must match one-to-one");
  for (const question of eggQuestions) {
    const egg = bank.easter_eggs.find((item) => item.source_qid === question.id);
    if (!egg || egg.option_mapping?.length !== question.options.length || egg.option_mapping.some((item) => !item.option_id || !item.label || !item.desc)) fail(bank, `Q${question.id} has incomplete easter egg configuration`);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadConfiguredData() {
  const registry = readJson(path.join(root, "data", "quiz-versions.v1.json"));
  const presentation = readJson(path.join(root, "data", "persona-presentation.v1.json"));
  const profiles = Object.fromEntries(fs.readdirSync(path.join(root, "data", "algorithms"))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const profile = readJson(path.join(root, "data", "algorithms", file));
      return [profile.id, profile];
    }));
  const banks = Object.fromEntries(registry.versions.filter((item) => item.enabled).map((item) => [
    item.id,
    readJson(path.join(root, "data", "banks", `${item.id}.v${item.bank_version}.json`))
  ]));
  return { registry, banks, profiles, presentation };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { registry, banks, profiles, presentation } = loadConfiguredData();
  validateConfiguredPresentation(registry, banks, presentation);
  const enabled = validateConfiguredBanks(registry, banks, profiles);
  for (const item of enabled) {
    const bank = banks[item.id];
    console.log(`PASS ${item.id}: ${bank.questions.length} questions, ${bank.tags.length} tags`);
  }
  console.log(`PASS persona presentation: v${presentation.version}`);
}
