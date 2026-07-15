# 配置驱动的三版本校园人设测试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在一个校园人设应用中开放高中、大学、硕博三版，使题库、界面元数据和算法参数可配置，并保证第 20 题不能改变主标签或四维结果。

**Architecture:** `data/banks/`、版本注册表和私有算法配置是构建输入；统一构建器生成浏览器、`get-bank` 和 `submit-quiz` 各自需要的公开/私有产物。前端通过版本上下文渲染同一套页面，后端通过版本仓库加载题库与算法配置，所有版本返回相同结果协议。

**Tech Stack:** Node.js ESM/CommonJS、Node test runner、JSON、JSON Schema、原生 HTML/CSS/JavaScript、微信云开发云函数。

## Global Constraints

- 保持大学版现有视觉语言，不复制三套页面。
- `data/banks/*.v5.0.0.json` 是运行题库的唯一权威来源；Markdown 仅作需求追溯。
- 不增加外部服务、运行时依赖、数据库迁移或密钥文件。
- 前端产物不能包含 `scores`、`core_questions`、标签目标向量或私有算法阈值。
- Q1-Q19 每题四个选项；Q20 十六个选项；每版十六个标签和二十道题。
- Q20 的默认角色为 `self_perception_only`；改变 Q20 答案不能改变主标签和四维结果。
- 本地浏览器和微信云函数必须使用同一算法模块及同一结果协议。
- 错误和超时必须进入可恢复终态，不允许永久停留在“正在生成结果”。
- `.env`、AppID、环境 ID、`OPENID_HMAC_SECRET` 和用户身份不得写入日志或提交。
- 当前 `E:\SCTI_Study` 没有 `.git` 元数据；执行阶段每个任务保留逻辑提交边界，最终在受控 Git 克隆中按任务提交并推送。

---

### Task 1: 冻结版本注册表与算法配置协议

**Files:**
- Create: `data/quiz-versions.v1.json`
- Create: `data/algorithms/three-layer.v2.0.0.json`
- Create: `schemas/quiz-version-registry.schema.json`
- Create: `schemas/algorithm-profile.schema.json`
- Modify: `schemas/question-bank.schema.json`
- Modify: `data/banks/university.v5.0.0.json`
- Modify: `data/banks/high_school.v5.0.0.json`
- Modify: `data/banks/graduate.v5.0.0.json`
- Modify: `data/banks/revision-log.v5.0.0.json`
- Modify: `scripts/validate-question-banks.mjs`
- Test: `tests/question-banks.test.js`

**Interfaces:**
- Consumes: canonical banks with `version`, `bank_version`, `tags`, `questions`, `dimension_config`.
- Produces: registry entries keyed by `id`; banks with `algorithm_profile`; profile `three-layer.v2.0.0`; exports `validateRegistry(registry, banks, profiles)` and `validateAlgorithmProfile(profile)`.

- [ ] **Step 1: Add failing registry/profile contract tests**

Append tests that load the registry, profile and all canonical banks:

```js
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

test("Q20 is self perception only in all canonical banks", () => {
  for (const id of ["high_school", "university", "graduate"]) {
    const bank = readJson(`data/banks/${id}.v5.0.0.json`);
    assert.equal(bank.questions.find((question) => question.id === 20).result_effect, "self_perception_only");
  }
});
```

Add this helper near the top of the test file:

```js
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8"));
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test tests/question-banks.test.js
```

Expected: FAIL because `data/quiz-versions.v1.json` and exported registry/profile validators do not exist.

- [ ] **Step 3: Add the complete public version registry**

Create `data/quiz-versions.v1.json` with this stable shape:

```json
{
  "$schema": "../schemas/quiz-version-registry.schema.json",
  "schema_version": "1.0.0",
  "default_version": "university",
  "versions": [
    {
      "id": "high_school",
      "enabled": true,
      "order": 1,
      "bank_version": "5.0.0",
      "title": "高中版",
      "identity_name": "高中生",
      "identity_desc": "高中阶段 · 20 道校园场景题",
      "icon": "📚",
      "quiz_label": "高中版 · V5.0.0",
      "welcome_label": "高中版 · 趣味校园人格测试",
      "welcome_copy": "看看你在高中校园里藏着哪一种独特人设。",
      "cache_namespace": "campus-persona-high-school",
      "public_bank_file": "high_school.v5.0.0.public.json",
      "theme": { "accent": "#86dfbf", "accent_light": "#ddf8eb", "card": "#fff0a8" }
    },
    {
      "id": "university",
      "enabled": true,
      "order": 2,
      "bank_version": "5.0.0",
      "title": "大学版",
      "identity_name": "大学生",
      "identity_desc": "本科 / 专科阶段 · 20 道大学场景题",
      "icon": "🎓",
      "quiz_label": "大学版 · V5.0.0",
      "welcome_label": "大学版 · 趣味校园人格测试",
      "welcome_copy": "看看你在大学校园里藏着哪一种独特人设。",
      "cache_namespace": "campus-persona-university",
      "public_bank_file": "university.v5.0.0.public.json",
      "theme": { "accent": "#f3a8c2", "accent_light": "#fde3ed", "card": "#fff0a8" }
    },
    {
      "id": "graduate",
      "enabled": true,
      "order": 3,
      "bank_version": "5.0.0",
      "title": "硕博版",
      "identity_name": "硕博生",
      "identity_desc": "硕士 / 博士阶段 · 20 道科研场景题",
      "icon": "🔬",
      "quiz_label": "硕博版 · V5.0.0",
      "welcome_label": "硕博版 · 趣味校园人格测试",
      "welcome_copy": "看看你在科研生活里藏着哪一种独特人设。",
      "cache_namespace": "campus-persona-graduate",
      "public_bank_file": "graduate.v5.0.0.public.json",
      "theme": { "accent": "#cdb6f6", "accent_light": "#eee5ff", "card": "#fff0a8" }
    }
  ]
}
```

- [ ] **Step 4: Add the complete private algorithm profile**

Create `data/algorithms/three-layer.v2.0.0.json`:

```json
{
  "$schema": "../../schemas/algorithm-profile.schema.json",
  "id": "three-layer.v2.0.0",
  "strategy": "three_layer",
  "scored_effect": "scored",
  "main_result": { "excluded_question_ids": [20] },
  "core": {
    "minimum_projected_questions": 2,
    "require_unique_match": true,
    "max_score_gap_from_leader": 2
  },
  "score": { "minimum_lead": 3 },
  "dimension": {
    "metric": "manhattan",
    "precision": 2,
    "candidate_score_gap": 2
  },
  "self_perception": { "question_id": 20, "role": "self_perception_only" }
}
```

The core layer may select a tag only when exactly one projected Q1-Q19 core matches and that tag is no more than two score points behind the Q1-Q19 leader. Multiple projected core matches fall through to score/dimension resolution instead of choosing the first tag by ID.

- [ ] **Step 5: Update bank/schema fields and revision history**

For all three canonical banks:

```json
"algorithm_profile": "three-layer.v2.0.0"
```

Change only Q20 from:

```json
"result_effect": "scored"
```

to:

```json
"result_effect": "self_perception_only"
```

Update `question-bank.schema.json` to require `algorithm_profile` and allow `result_effect` values `scored`, `egg_only`, and `self_perception_only`. Add registry/profile schemas matching the exact fields and enums above. Append a revision-log entry recording that Q20 was removed from core, score and dimension decisions on 2026-07-13.

- [ ] **Step 6: Implement explicit validators**

Add exports with these contracts:

```js
export function validateAlgorithmProfile(profile) {
  if (!/^three-layer\.v\d+\.\d+\.\d+$/.test(profile?.id || "")) throw new Error("invalid algorithm profile id");
  if (profile.strategy !== "three_layer") throw new Error("unsupported algorithm strategy");
  if (profile.self_perception?.question_id !== 20 || profile.self_perception?.role !== "self_perception_only") throw new Error("Q20 must be self_perception_only");
  if (profile.score?.minimum_lead < 1) throw new Error("score.minimum_lead must be positive");
}

export function validateRegistry(registry, banks, profiles) {
  const enabled = registry?.versions?.filter((item) => item.enabled) || [];
  const ids = enabled.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("registry version ids must be unique");
  for (const item of enabled) {
    const bank = banks[item.id];
    if (!bank) throw new Error(`registry bank missing: ${item.id}`);
    if (bank.bank_version !== item.bank_version) throw new Error(`bank version mismatch: ${item.id}`);
    if (!profiles[bank.algorithm_profile]) throw new Error(`algorithm profile missing: ${item.id}`);
  }
}
```

Extend `validateBank` to require the algorithm profile and exactly one Q20 with `self_perception_only`; continue validating all original structural, core and copy rules.

- [ ] **Step 7: Run tests and standalone validation**

Run:

```powershell
node --test tests/question-banks.test.js
node scripts/validate-question-banks.mjs
```

Expected: all tests PASS and three `PASS <version>: 20 questions, 16 tags` lines.

- [ ] **Step 8: Record the logical commit boundary**

Commit message for the later Git worktree:

```text
feat: add version registry and configurable algorithm profile
```

---

### Task 2: Build all public and private bank artifacts deterministically

**Files:**
- Create: `campus_persona/scripts/build-question-banks.mjs`
- Modify: `campus_persona/scripts/build-university-bank.mjs`
- Modify: `campus_persona/package.json`
- Create: `campus_persona/tests/build-question-banks.test.js`
- Generated: `campus_persona/data/runtime-registry.json`
- Generated: `campus_persona/data/banks/*.json`
- Generated: `campus_persona/data/algorithms/*.json`
- Generated: `campus_persona/cloudfunctions/get-bank/data/*`
- Generated: `campus_persona/cloudfunctions/submit-quiz/data/*`
- Generated: `frontend-demo/data/*`

**Interfaces:**
- Consumes: `data/quiz-versions.v1.json`, `data/banks/*.v5.0.0.json`, `data/algorithms/*.json`.
- Produces: `createPublicBank(bank)`, `buildQuestionBanks(options)`, synchronized deployment artifacts and a public registry.

- [ ] **Step 1: Write failing public-artifact tests**

Create tests with these assertions:

```js
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
```

The CommonJS test file imports `node:fs` and `node:path` and defines `__dirname` through the normal CommonJS runtime; no working-directory-relative file reads are allowed.

- [ ] **Step 2: Run the build test and verify RED**

Run:

```powershell
cd campus_persona
node --test tests/build-question-banks.test.js
```

Expected: FAIL because `build-question-banks.mjs` does not exist.

- [ ] **Step 3: Implement a score-free public-bank projection**

Use this exact output contract:

```js
export function createPublicBank(bank) {
  return {
    version: bank.version,
    bank_version: bank.bank_version,
    status: bank.status,
    dimension_config: bank.dimension_config,
    questions: bank.questions.map(({ id, text, type, result_effect, emoji_type, options }) => ({
      id,
      text,
      type,
      result_effect,
      emoji_type,
      options: options.map(({ id: optionId, index, text: optionText }) => ({ id: optionId, index, text: optionText }))
    }))
  };
}
```

`buildQuestionBanks({ write = true } = {})` must load and validate all inputs before writing any file, build an in-memory list of `{ target, value }`, then write every item only after all versions succeed. This prevents partial deployments.

The ESM module must run `buildQuestionBanks()` only when invoked as the process entry file; importing `createPublicBank` or `buildQuestionBanks` from tests must not write files.

- [ ] **Step 4: Generate exact runtime targets**

Write the public registry to:

```text
campus_persona/data/runtime-registry.json
campus_persona/cloudfunctions/get-bank/data/runtime-registry.json
campus_persona/cloudfunctions/submit-quiz/data/runtime-registry.json
frontend-demo/data/runtime-registry.json
```

Write each public bank to `get-bank/data/` and `frontend-demo/data/`; write each private bank and profile only to `campus_persona/data/` and `submit-quiz/data/`. Do not write private algorithm files under `frontend-demo` or `get-bank`.

- [ ] **Step 5: Keep command compatibility while switching to the all-bank build**

Replace `build-university-bank.mjs` with a compatibility import:

```js
import { buildQuestionBanks } from "./build-question-banks.mjs";

buildQuestionBanks();
```

Update scripts:

```json
{
  "build:banks": "node scripts/build-question-banks.mjs",
  "build:bank": "npm run build:banks",
  "test": "node --test tests/*.test.js ../tests/question-banks.test.js"
}
```

- [ ] **Step 6: Run the build twice and verify deterministic output**

Run:

```powershell
npm run build:banks
npm run build:banks
node --test tests/build-question-banks.test.js
```

Expected: both builds report `Built 3 banks` with identical file contents; tests PASS.

- [ ] **Step 7: Record the logical commit boundary**

```text
feat: build synchronized artifacts for all quiz versions
```

---

### Task 3: Make the scoring engine profile-driven and Q20-invariant

**Files:**
- Modify: `campus_persona/cloudfunctions/submit-quiz/algorithm.js`
- Modify: `campus_persona/tests/algorithm.test.js`
- Create: `campus_persona/tests/fixtures/algorithm-golden.json`

**Interfaces:**
- Consumes: `calculateResult(answers, bank, profile)` where `answers` covers all twenty questions.
- Produces: versioned result object with tag copy, dimensions, eggs, self perception and share copy.

- [ ] **Step 1: Replace Q20-dependent tests with three-version invariants**

Load generated private banks/profile with these exact helpers:

```js
const fs = require("node:fs");
const path = require("node:path");

function readGeneratedJson(...segments) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", ...segments), "utf8"));
}

const profile = readGeneratedJson("algorithms", "three-layer.v2.0.0.json");
const banks = Object.fromEntries(["high_school", "university", "graduate"].map((version) => [
  version,
  readGeneratedJson("banks", `${version}.v5.0.0.json`)
]));

function completeAnswers(bank, overrides = {}) {
  return bank.questions.map((question) => ({
    qid: question.id,
    selected: overrides[question.id] ?? 0
  }));
}
```

Then add:

```js
for (const version of ["high_school", "university", "graduate"]) {
  test(`${version}: changing only Q20 cannot change persona or dimensions`, () => {
    const bank = banks[version];
    const baseline = completeAnswers(bank, { 20: 0 });
    const expected = calculateResult(baseline, bank, profile);
    for (let selected = 1; selected < 16; selected += 1) {
      const actual = calculateResult(completeAnswers(bank, { 20: selected }), bank, profile);
      assert.equal(actual.tag_id, expected.tag_id);
      assert.deepEqual(actual.dimensions.user_vector, expected.dimensions.user_vector);
      assert.equal(actual.self_perception.option_id, bank.questions[19].options[selected].id);
    }
  });
}

test("dimension labels and share copy come from the selected bank", () => {
  const bank = banks.high_school;
  const result = calculateResult(completeAnswers(bank), bank, profile);
  const tag = bank.tags.find((item) => item.id === result.tag_id);
  assert.deepEqual(result.dimensions.labels, bank.dimension_config.labels);
  assert.equal(result.share_copy, tag.share_copy);
});
```

The golden fixture must contain these stable baseline cases:

```json
{
  "university": { "overrides": { "1": 3, "3": 2, "7": 1, "12": 3, "18": 2 }, "tag_id": "U1", "match_method": "core" },
  "high_school": { "overrides": {}, "tag_id": "H1", "match_method": "score" },
  "graduate": { "overrides": {}, "tag_id": "G12", "match_method": "score" }
}
```

- [ ] **Step 2: Run algorithm tests and verify RED**

Run:

```powershell
cd campus_persona
node --test tests/algorithm.test.js
```

Expected: FAIL because the current engine accepts no profile, Q20 participates in core/score/dimensions, labels are hardcoded, and no self-perception/share fields are returned.

- [ ] **Step 3: Filter the main-result question set through the profile**

Implement and export:

```js
function mainResultQuestionIds(bank, profile) {
  const excluded = new Set(profile.main_result.excluded_question_ids);
  return new Set(bank.questions
    .filter((question) => question.result_effect === profile.scored_effect && !excluded.has(question.id))
    .map((question) => question.id));
}
```

Use this same set for core projection, score accumulation and dimension vectors. Egg collection remains based on `egg_only` questions.

- [ ] **Step 4: Make core resolution deterministic without Q20**

Replace first-tag wins with:

```js
function coreCandidates(answers, bank, profile, includedIds) {
  const answerMap = new Map(answers.map(({ qid, selected }) => [qid, selected]));
  const questions = new Map(bank.questions.map((question) => [question.id, question]));
  return bank.tags.filter((tag) => {
    const projected = tag.core_questions.filter((core) => includedIds.has(core.qid));
    return projected.length >= profile.core.minimum_projected_questions
      && projected.every((core) => questions.get(core.qid).options[answerMap.get(core.qid)]?.id === core.option_id);
  });
}
```

Select a core result only when `require_unique_match` is satisfied and the unique candidate score is within `max_score_gap_from_leader` of the score leader. Otherwise continue to the next layer.

- [ ] **Step 5: Restrict dimension fallback to competitive score candidates**

When the score lead is below `minimum_lead`, retain only tags whose score is at least `topScore - candidate_score_gap`, then choose the minimum Manhattan distance. Break exact ties by tag ID for reproducibility.

Return this result shape:

```js
{
  version: bank.version,
  bank_version: bank.bank_version,
  algorithm_version: profile.id,
  tag_id: tag.id,
  tag_name: tag.name,
  tag_short_desc: tag.short_desc,
  tag_full_desc: tag.full_desc,
  keywords: tag.keywords,
  share_copy: tag.share_copy,
  match_method,
  scores_ranking: ranking,
  dimensions: {
    labels: bank.dimension_config.labels,
    user_vector: userVector,
    target_vector: tag.dimensions,
    manhattan_distance: distance
  },
  easter_eggs: collectEasterEggs(answers, bank),
  self_perception: { qid: 20, option_id: option.id, text: option.text }
}
```

- [ ] **Step 6: Run algorithm and bank tests**

Run:

```powershell
npm test
```

Expected: all algorithm, build and canonical-bank tests PASS; the 48 Q20 variations do not alter any primary result.

- [ ] **Step 7: Record the logical commit boundary**

```text
fix: make persona scoring independent of the final question
```

---

### Task 4: Route `get-bank` and `submit-quiz` by configured version

**Files:**
- Create: `campus_persona/cloudfunctions/get-bank/bank-store.js`
- Modify: `campus_persona/cloudfunctions/get-bank/index.js`
- Create: `campus_persona/cloudfunctions/submit-quiz/bank-store.js`
- Modify: `campus_persona/cloudfunctions/submit-quiz/index.js`
- Modify: `campus_persona/cloudfunctions/user-login/index.js`
- Create: `campus_persona/tests/version-routing.test.js`

**Interfaces:**
- Produces: `getPublicBank(version, clientBankVersion)` and `getRuntime(version, bankVersion)` pure loaders.
- Cloud API: `get-bank({ action: "versions" })`, `get-bank({ version, client_bank_version })`, `submit-quiz({ version, bank_version, answers, duration_seconds })`.

- [ ] **Step 1: Write failing loader and routing tests**

```js
test("get-bank resolves every enabled public bank", () => {
  for (const version of ["high_school", "university", "graduate"]) {
    const response = getPublicBank(version, "");
    assert.equal(response.version, version);
    assert.equal(response.need_update, true);
  }
});

test("submit runtime rejects unknown and mismatched versions", () => {
  assert.throws(() => getRuntime("unknown", "5.0.0"), (error) => error.code === 404);
  assert.throws(() => getRuntime("university", "4.9.0"), (error) => error.code === 409);
  assert.equal(getRuntime("graduate", "5.0.0").bank.version, "graduate");
});
```

- [ ] **Step 2: Run the routing test and verify RED**

Run:

```powershell
cd campus_persona
node --test tests/version-routing.test.js
```

Expected: FAIL because both bank stores are missing.

- [ ] **Step 3: Implement self-contained pure bank stores**

Both stores load generated `data/runtime-registry.json`. Define a local error class:

```js
class BankRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
```

`getRuntime` must return `{ versionConfig, bank, profile }`, reject disabled/unknown versions with 404 and reject `bank_version` mismatch with 409. `getPublicBank` must return the public bank plus `need_update`.

- [ ] **Step 4: Make `get-bank` expose registry or a versioned bank**

Use:

```js
exports.main = async (event = {}) => {
  try {
    if (event.action === "versions") return { code: 0, message: "success", data: publicRegistry };
    return { code: 0, message: "success", data: getPublicBank(event.version, event.client_bank_version || "") };
  } catch (error) {
    return { code: error.code || 500, message: error.message || "题库服务暂不可用", data: null };
  }
};
```

- [ ] **Step 5: Make `submit-quiz` dynamic and preserve privacy**

Resolve runtime before validating answers:

```js
const { bank, profile } = getRuntime(event.version, event.bank_version);
validateAnswers(event.answers, bank);
const serverResult = calculateResult(event.answers, bank, profile);
```

Use `event.version` for rate limiting, record storage and tag statistics. New users may have `identity_type: null`; after a successful submission update `last_identity_type: event.version`. Never log answers, openid, hashes or secrets.

Return Chinese error messages in valid UTF-8:

```js
if (error.code === 409) return errorResponse(409, "题库已更新，请刷新后重新提交");
if (error.message.includes("answers")) return errorResponse(400, "答题数据不完整或格式错误");
```

- [ ] **Step 6: Run backend tests**

Run:

```powershell
npm test
```

Expected: routing, algorithm, build and canonical-bank tests PASS.

- [ ] **Step 7: Record the logical commit boundary**

```text
feat: route cloud functions across all quiz versions
```

---

### Task 5: Bring the local browser result service to backend parity

**Files:**
- Modify: `frontend-demo/local-result.mjs`
- Modify: `frontend-demo/api/cloud.js`
- Modify: `frontend-demo/tests/local-result.test.mjs`

**Interfaces:**
- Consumes: `{ version, bank_version, answers, duration_seconds }`.
- Produces: the same `{ code, message, data: { record_id, server_result, match_confirmed, tag_stats } }` shape as `submit-quiz`.

- [ ] **Step 1: Add failing three-version local tests**

Load private generated banks in the ESM test file:

```js
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const privateBanks = Object.fromEntries(["high_school", "university", "graduate"].map((version) => [
  version,
  require(`../../campus_persona/data/banks/${version}.v5.0.0.json`)
]));
```

Then add:

```js
for (const version of ["high_school", "university", "graduate"]) {
  test(`local result supports ${version}`, () => {
    const bank = privateBanks[version];
    const response = calculateLocalResult({
      version,
      bank_version: bank.bank_version,
      answers: bank.questions.map((question) => ({ qid: question.id, selected: 0 }))
    });
    assert.equal(response.code, 0);
    assert.equal(response.data.server_result.version, version);
  });
}

test("local result rejects a stale bank version", () => {
  assert.throws(() => calculateLocalResult({ version: "university", bank_version: "4.9.0", answers: [] }), /题库已更新/);
});
```

- [ ] **Step 2: Run local tests and verify RED**

Run:

```powershell
cd frontend-demo
npm test
```

Expected: FAIL because `calculateLocalResult` only accepts university.

- [ ] **Step 3: Reuse the generated runtime and shared algorithm**

Load `campus_persona/data/runtime-registry.json`, private banks and profile into version maps. Resolve by `version` and `bank_version`, call `calculateResult(data.answers, bank, profile)`, and preserve the cloud response shape. Do not create a second scoring implementation.

- [ ] **Step 4: Export a testable timeout wrapper and correct recovery copy**

In `api/cloud.js` export:

```js
export function withTimeout(promise, message, timeoutMs = RESULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
```

Use the same timeout for cloud calls and local fetch. Error copy must tell the user either to retry or run `npm start`; it must not leave the analysis state pending.

- [ ] **Step 5: Run local tests**

Run:

```powershell
npm test
```

Expected: all local-result and answer-state tests PASS.

- [ ] **Step 6: Record the logical commit boundary**

```text
feat: support all quiz versions in local result service
```

---

### Task 6: Add a version-aware frontend data and progress layer

**Files:**
- Create: `frontend-demo/version-context.mjs`
- Modify: `frontend-demo/api/cloud.js`
- Modify: `frontend-demo/answer-state.mjs`
- Create: `frontend-demo/tests/version-context.test.mjs`
- Modify: `frontend-demo/tests/answer-state.test.mjs`
- Modify: `frontend-demo/package.json`

**Interfaces:**
- Produces: `enabledVersions(registry)`, `findVersion(registry, id)`, `progressKey(versionConfig)`, `applyTheme(root, versionConfig)`, `getVersionRegistry()`, `getBank(version, clientBankVersion)`.

- [ ] **Step 1: Write failing version-context tests**

```js
test("enabled versions follow registry order", () => {
  const versions = enabledVersions(registry);
  assert.deepEqual(versions.map((item) => item.id), ["high_school", "university", "graduate"]);
});

test("progress keys isolate version and bank version", () => {
  const highSchool = findVersion(registry, "high_school");
  const graduate = findVersion(registry, "graduate");
  assert.equal(progressKey(highSchool), "campus-persona-high-school:5.0.0:progress");
  assert.notEqual(progressKey(highSchool), progressKey(graduate));
});

test("restored answers from another version are rejected", () => {
  const restored = restoreProgressSnapshot({ version: "university", bankVersion: "5.0.0", answers: { 1: 0 } }, highSchoolBank);
  assert.equal(restored, null);
});
```

- [ ] **Step 2: Run frontend tests and verify RED**

Run:

```powershell
cd frontend-demo
npm test
```

Expected: FAIL because `version-context.mjs` and `restoreProgressSnapshot` are missing.

- [ ] **Step 3: Implement pure version helpers**

```js
export function enabledVersions(registry) {
  return [...registry.versions].filter((item) => item.enabled).sort((a, b) => a.order - b.order);
}

export function findVersion(registry, id) {
  const item = enabledVersions(registry).find((version) => version.id === id);
  if (!item) throw new Error("该测试版本暂不可用");
  return item;
}

export function progressKey(versionConfig) {
  return `${versionConfig.cache_namespace}:${versionConfig.bank_version}:progress`;
}

export function applyTheme(root, versionConfig) {
  root.style.setProperty("--version-accent", versionConfig.theme.accent);
  root.style.setProperty("--version-accent-light", versionConfig.theme.accent_light);
  root.style.setProperty("--version-card", versionConfig.theme.card);
}
```

- [ ] **Step 4: Make API caches version-keyed**

Replace the single cached bank with `Map` instances. `getVersionRegistry()` requests `{ action: "versions" }` in WeChat or fetches `./data/runtime-registry.json` locally. `getBank(version, clientBankVersion = "")` requests the requested version and stores it under `${version}:${bank_version}`.

- [ ] **Step 5: Validate complete cache snapshots before restoring**

Add:

```js
export function restoreProgressSnapshot(snapshot, bank) {
  if (!snapshot || snapshot.version !== bank.version || snapshot.bankVersion !== bank.bank_version) return null;
  const answers = normalizeStoredAnswers(bank.questions, snapshot.answers);
  return { ...snapshot, answers };
}
```

Saved snapshots must include `version` and `bankVersion`. Invalid snapshots are ignored and removed by the caller.

- [ ] **Step 6: Include the new test file in `npm test` and run it**

```json
"test": "node --test tests/*.test.mjs"
```

Run `npm test`; expected all frontend pure-module tests PASS.

- [ ] **Step 7: Record the logical commit boundary**

```text
feat: isolate frontend state by quiz version
```

---

### Task 7: Render all three versions with the university visual system

**Files:**
- Modify: `frontend-demo/app.js`
- Modify: `frontend-demo/index.html`
- Modify: `frontend-demo/style.css`
- Create: `frontend-demo/ui-model.mjs`
- Create: `frontend-demo/tests/ui-model.test.mjs`

**Interfaces:**
- Consumes: public registry, selected public bank and unified server result.
- Produces: one identity chooser and one shared welcome/quiz/analysis/result renderer.

- [ ] **Step 1: Write failing UI-model and hardcoding tests**

Load the runtime registry and canonical banks in the ESM test:

```js
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const registry = require("../data/runtime-registry.json");
const privateBanks = Object.fromEntries(["high_school", "university", "graduate"].map((version) => [
  version,
  require(`../../data/banks/${version}.v5.0.0.json`)
]));
```

Then add:

```js
test("identity cards are generated from three enabled registry entries", () => {
  const cards = identityCardModels(registry, "university");
  assert.deepEqual(cards.map((item) => item.id), ["high_school", "university", "graduate"]);
  assert.equal(cards.find((item) => item.id === "university").selected, true);
});

test("question hints distinguish eggs and self perception", () => {
  assert.match(questionHint({ result_effect: "egg_only" }), /彩蛋/);
  assert.match(questionHint({ result_effect: "self_perception_only" }), /不参与主标签/);
});

test("app source does not embed canonical questions or tag names", () => {
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  for (const bank of Object.values(privateBanks)) {
    assert.equal(source.includes(bank.questions[0].text), false);
    assert.equal(source.includes(bank.tags[0].name), false);
  }
});
```

- [ ] **Step 2: Run UI tests and verify RED**

Run:

```powershell
cd frontend-demo
npm test
```

Expected: FAIL because `ui-model.mjs` is missing.

- [ ] **Step 3: Initialize the app with registry before loading a bank**

Use state fields:

```js
const state = {
  screen: "welcome",
  registry: null,
  activeVersion: null,
  bank: null,
  questionIndex: 0,
  answers: {},
  startTime: Date.now(),
  result: null,
  error: null,
  submitting: false
};
```

Boot with `getVersionRegistry()`. Load a bank only after `select-version` or when restoring a valid last selected version. This lets the identity page exist without a university hardcode.

- [ ] **Step 4: Generate identity cards and dynamic page copy**

Each card uses `data-version`, registry icon/name/description and selected state. Welcome and quiz headers use `activeVersion.welcome_label` and `activeVersion.quiz_label`. Q20 uses the self-perception hint: “这一题用于记录你的直觉自我认知，不参与主标签和四维计算。”

All version-specific color differences use these CSS variables:

```css
:root {
  --version-accent: var(--pink);
  --version-accent-light: #fde3ed;
  --version-card: var(--yellow);
}

.identity-card.is-selected,
.question-card { background: var(--version-card); }
.result-hero,
.analysis-orbit { background: var(--version-accent-light); }
.progress-value,
.option-button.is-selected { background: var(--version-accent); }
```

- [ ] **Step 5: Submit the selected version and bank version**

`finishQuiz()` must send:

```js
await submitQuiz({
  version: state.activeVersion.id,
  bank_version: state.bank.bank_version,
  answers,
  duration_seconds: Math.round((Date.now() - state.startTime) / 1000)
});
```

Guard against duplicate submits with `state.submitting`. On errors, set `submitting = false`, keep answers, return to quiz, display the error and provide “重新生成结果”.

- [ ] **Step 6: Render the unified result without fallback content**

Use only server fields for tag descriptions, dimensions, eggs, self perception and share copy. Add a self-perception section when present. If required fields are missing, show a recoverable “结果数据不完整，请重新生成” state; do not invent university copy.

Share title/text must use `result.tag_name` and `result.share_copy`. The modal hashtags use `activeVersion.title`, not `#大学版`.

- [ ] **Step 7: Correct document UTF-8 copy and remove result debug tab assumptions**

Set the HTML title to `校园人设测试 · 三版本 Demo`. Keep the desktop prototype wrapper, but prevent the result debug tab from rendering when `state.result` is null. Preserve the extracted mini-program phone style and existing mobile breakpoints.

- [ ] **Step 8: Run frontend tests and a local smoke flow**

Run:

```powershell
npm test
npm start
```

From another terminal, request:

```powershell
Invoke-WebRequest http://127.0.0.1:4173/data/runtime-registry.json | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest http://127.0.0.1:4173/data/high_school.v5.0.0.public.json | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest http://127.0.0.1:4173/data/graduate.v5.0.0.public.json | Select-Object -ExpandProperty StatusCode
```

Expected: all return `200`; manual phone preview completes one flow for each version and no flow remains on the analysis page after an error.

- [ ] **Step 9: Record the logical commit boundary**

```text
feat: open high school and graduate quiz experiences
```

---

### Task 8: Full verification, maintenance docs and WeChat deployment handoff

**Files:**
- Modify: `campus_persona/README.md`
- Modify: `frontend-demo/README.md`
- Modify: `campus_persona/docs/mvp-spec.md`
- Create: `campus_persona/docs/wechat-cloud-deployment.md`
- Create: `docs/superpowers/reports/three-version-campus-persona-builder.md`

**Interfaces:**
- Produces: exact maintenance commands, production boundary, cloud prerequisites, deployment sequence and verification evidence.

- [ ] **Step 1: Document the one-source maintenance workflow**

Document these exact commands:

```powershell
cd E:\SCTI_Study
node scripts/validate-question-banks.mjs
cd campus_persona
npm run build:banks
npm test
cd ..\frontend-demo
npm test
npm start
```

Explain that routine content updates modify `data/banks/`, algorithm parameter changes create a new file under `data/algorithms/`, and a new identity adds one bank plus one registry entry. Generated deployment JSON must never be hand-edited.

- [ ] **Step 2: Supersede the university-only MVP statements**

Update `mvp-spec.md` to reference the approved three-version design. Preserve the privacy and platform notes, but remove statements that other versions return 404 or remain future work.

- [ ] **Step 3: Write the exact CloudBase handoff boundary**

The deployment document must state:

```text
Repository-ready backend functions:
- get-bank
- submit-quiz
- user-login
- record-share

User-owned prerequisites:
- registered/authorized Mini Program AppID
- WeChat DevTools QR login
- selected CloudBase environment
- account certification, service category, billing and release approval
- OPENID_HMAC_SECRET configured only in the cloud function environment

Cloud collections:
- users
- quiz_records
- share_records

Recommended indexes:
- users: provider_subject_hash + platform
- quiz_records: user_id + version + created_at
- quiz_records: version + result.tag_id
```

Deployment sequence: run validation/build/tests; bind the selected cloud environment; upload and deploy each function with cloud-side dependency installation; verify `get-bank` for all three versions; perform authenticated `submit-quiz`; inspect sanitized logs; then upload the mini-program client as a development version.

State clearly that the current `frontend-demo` is a browser acceptance client, not yet a native WXML/WXSS package. Native-client adaptation, experience-version testing, review submission and final release are a separate production phase. No AppSecret is required for this code handoff.

- [ ] **Step 4: Run the complete automated verification from a clean build**

Run:

```powershell
cd E:\SCTI_Study
node scripts/validate-question-banks.mjs
node --test tests/question-banks.test.js
cd campus_persona
npm run build:banks
npm test
cd ..\frontend-demo
npm test
```

Expected: every command exits `0`; all three banks build; backend and frontend tests pass.

- [ ] **Step 5: Verify Q20 invariance against all 48 choices**

Run the focused algorithm test by name:

```powershell
cd E:\SCTI_Study\campus_persona
node --test --test-name-pattern="changing only Q20" tests/algorithm.test.js
```

Expected: three version tests PASS, covering sixteen Q20 options each.

- [ ] **Step 6: Perform read-only privacy and hardcoding scans**

Run:

```powershell
rg -n 'OPENID_HMAC_SECRET\s*=\s*[^<\s]' . -g '!node_modules/**' -g '!.env*'
rg -n 'version:\s*["'']university["'']|university-bank|#大学版' frontend-demo campus_persona/cloudfunctions -g '!tests/**'
rg -n '"scores"|"core_questions"' frontend-demo/data campus_persona/cloudfunctions/get-bank/data
```

Expected: no committed secret value; no runtime university-only routing or filenames; no scores/core mappings in public outputs. Documentation references are allowed only when explaining migration history.

- [ ] **Step 7: Record Builder evidence and Reviewer findings**

The report must list modified files, exact test counts, three manual browser flows, Q20 invariant evidence, privacy scan result and the known production boundary: native mini-program client and authenticated CloudBase deployment are not part of the browser-parity implementation.

- [ ] **Step 8: Record the logical commit boundary**

```text
docs: add three-version maintenance and deployment handoff
```

## Execution Order and Review Gates

Execute Tasks 1–8 in order because every later task consumes artifacts or interfaces created earlier. For each task use:

1. Builder writes only the files named by that task and runs the focused tests.
2. Spec Reviewer checks requirement coverage without editing.
3. Code Reviewer checks maintainability, privacy and regressions without editing.
4. Builder addresses accepted findings before the next task.

After Task 8, copy the reviewed changes into a clean Git clone of `xiaoguill/SCTI_Study`, verify the diff excludes `.env`, `memory_data/`, `knowledge_base/`, caches and credentials, then create the listed logical commits or one reviewed release commit according to the user's chosen publishing workflow.
