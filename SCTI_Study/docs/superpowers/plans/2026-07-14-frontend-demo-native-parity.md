# Frontend Demo Native Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the native WeChat Mini Program visually and behaviorally match the mobile UI inside `frontend-demo`, including first-answer auto-advance, manual review navigation, actionable local-service status, and configurable result-character presentation.

**Architecture:** Keep the existing one-page native state machine and generated public runtime. Add pure navigation transitions to the native controller, keep timer ownership in the page adapter, add a local health boundary to the transport, and port browser-demo component tokens into WXML/WXSS from auditable extraction specs. Add a public presentation configuration that resolves character art by version and stable result tag without exposing scoring data.

**Tech Stack:** WeChat Mini Program JavaScript/WXML/WXSS, Node.js built-in test runner, existing Node local result server, existing question-bank build pipeline, WeChat DevTools.

## Global Constraints

- Do not change canonical questions, scoring weights, core questions, tags, four-dimension calculations, or Q20 semantics.
- Q20 remains self-perception-only and has sixteen choices in every version.
- Root `data/` remains the only canonical source; native WXML never hard-codes questions or result tags.
- Native runtime must not contain scores, core mappings, algorithm profiles, target vectors, or score rankings.
- Preserve the user's AppID, `project.private.config.json`, `.env*`, and runtime data.
- Empty `cloudEnvId` means local mode; non-empty means CloudBase mode; cloud errors never fall back to localhost.
- Local testing still requires `frontend-demo\\npm start`; the Mini Program cannot start a computer process.
- Do not change WeChat DevTools legal-domain/security settings on the user's behalf.
- The browser demo's desktop explanation and outer device frame are reference-only and are not copied into native WXML.
- Use TDD for behavior changes, small commits, and fresh verification before sync.

---

### Task 1: Record the frontend-demo extraction contract

**Files:**
- Create: `docs/research/frontend-demo/PAGE_TOPOLOGY.md`
- Create: `docs/research/frontend-demo/BEHAVIORS.md`
- Create: `docs/research/frontend-demo/components/welcome.spec.md`
- Create: `docs/research/frontend-demo/components/identity.spec.md`
- Create: `docs/research/frontend-demo/components/quiz.spec.md`
- Create: `docs/research/frontend-demo/components/analysis.spec.md`
- Create: `docs/research/frontend-demo/components/result.spec.md`
- Create: `docs/research/frontend-demo/components/share.spec.md`

**Interfaces:**
- Consumes: `frontend-demo/index.html`, `frontend-demo/style.css`, `frontend-demo/app.js`, generated registry/banks, mobile viewport screenshots.
- Produces: exact WXML/WXSS mapping contracts used by Tasks 4 and 5.

- [ ] **Step 1: Write the page topology**

Record the source-to-native state mapping exactly:

```markdown
| Source state | Source root | Native state | Native root |
|---|---|---|---|
| welcome | `.welcome-page` | `welcome` | `.welcome-screen` |
| identity | `.identity-page` | `identity` | `.identity-screen` |
| loading | `.loading-page` | `loading` | `.center-screen` |
| quiz | `.quiz-page` | `quiz` | `.quiz-screen` |
| analysis | `.analysis-page` | `analysis` | `.center-screen` |
| result | `.result-page` | `result` | `.result-screen` |
| share | `.share-modal` | native share/result fallback | result share controls |
```

Explicitly exclude `.prototype-intro`, `.phone-device`, `.phone-speaker`, `.status-bar`, and `.home-indicator` from the native port.

- [ ] **Step 2: Record behavior states**

Document:

```markdown
- First unanswered option tap: selected immediately, persist, guarded 280 ms auto-advance.
- First unanswered Q20 option tap: selected immediately, persist, guarded 280 ms submit.
- Previous: cancel pending continuation, enter review mode, decrement one question.
- Review option tap: persist without auto-advance.
- Review Next: advance manually; switch to auto at the first unanswered question.
- Version/restart/unload/submit: invalidate pending continuation.
```

- [ ] **Step 3: Write six component specifications**

For each component, include all headings:

```markdown
## Overview
## Source DOM Structure
## Native WXML Structure
## Exact Source CSS Values
## WXSS Mapping
## States and Behaviors
## Data Bindings
## Assets
## Text Content
## Mobile Responsive Behavior
```

Use values directly from `frontend-demo/style.css`, including `#fffdf3` paper, `#171717` ink, 4 px major borders, 28 px major card radius, 0 8 px soft shadow, 54 px primary button height, and the source component spacing. Convert CSS px to native `rpx` using the 390 px reference canvas (`1 px = 750 / 390 rpx`) and record both values.

- [ ] **Step 4: Verify extraction completeness**

Run:

```powershell
$required = @(
  'PAGE_TOPOLOGY.md','BEHAVIORS.md',
  'components/welcome.spec.md','components/identity.spec.md','components/quiz.spec.md',
  'components/analysis.spec.md','components/result.spec.md','components/share.spec.md'
)
$required | ForEach-Object {
  if (-not (Test-Path "docs/research/frontend-demo/$_")) { throw "Missing $_" }
}
rg -n "T[B]D|T[O]DO|PLACEH[O]LDER" docs/research/frontend-demo
```

Expected: all eight files exist; `rg` returns no matches.

- [ ] **Step 5: Commit**

```powershell
git add SCTI_Study/docs/research/frontend-demo
git commit -m "docs: specify frontend demo native parity"
```

---

### Task 2: Add first-answer auto-advance and manual review navigation

**Files:**
- Modify: `miniprogram/pages/index/controller.js`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/tests/page-controller.test.js`

**Interfaces:**
- Produces: `previousQuestionState(state)`, `nextQuestionState(state)`, `selectionNavigation(state, questionIndex, wasAnswered)`.
- Page methods: `clearPendingAdvance()`, `scheduleSelectionContinuation(snapshot)`, `scrollQuestionTop()`.

- [ ] **Step 1: Write failing pure transition tests**

Add tests:

```js
function loadedState(version) {
  let state = beginVersion(createPageState(runtime.registry), version);
  return acceptLoadedBank(state, runtime.banks[version], currentOperation(state));
}

test("first unanswered selections auto advance while review selections stay", () => {
  let state = loadedState("university");
  assert.equal(selectionNavigation(state, 0, false), "advance");
  state = selectAnswer(state, 1);
  state = previousQuestionState({ ...state, questionIndex: 1 });
  assert.equal(state.navigationMode, "review");
  assert.equal(selectionNavigation(state, 0, true), "stay");
});

test("review next returns to auto mode at the first unanswered question", () => {
  let state = loadedState("high_school");
  state = { ...state, answers: { 1: 0 }, questionIndex: 0, navigationMode: "review" };
  state = nextQuestionState(state);
  assert.equal(state.questionIndex, 1);
  assert.equal(state.navigationMode, "auto");
});

test("first unanswered Q20 selection requests submission", () => {
  const state = { ...loadedState("graduate"), questionIndex: 19 };
  assert.equal(selectionNavigation(state, 19, false), "submit");
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test miniprogram/tests/page-controller.test.js
```

Expected: FAIL because the three navigation helpers and `navigationMode` do not exist.

- [ ] **Step 3: Implement pure navigation transitions**

Add to `createPageState` and `beginVersion`:

```js
navigationMode: "auto"
```

Implement:

```js
function selectionNavigation(state, answeredIndex, wasAnswered) {
  if (state.screen !== "quiz" || state.questionIndex !== answeredIndex) return "stay";
  if (state.navigationMode !== "auto" || wasAnswered) return "stay";
  return answeredIndex === state.bank.questions.length - 1 ? "submit" : "advance";
}

function previousQuestionState(state) {
  if (state.questionIndex <= 0) return state;
  return { ...state, questionIndex: state.questionIndex - 1, navigationMode: "review", error: null };
}

function nextQuestionState(state) {
  const question = state.bank.questions[state.questionIndex];
  if (!Number.isInteger(state.answers[question.id])) {
    const error = new Error(`第 ${state.questionIndex + 1} 题尚未完成`);
    error.questionIndex = state.questionIndex;
    throw error;
  }
  if (state.questionIndex >= state.bank.questions.length - 1) return state;
  const nextIndex = state.questionIndex + 1;
  const nextQuestion = state.bank.questions[nextIndex];
  const nextAnswered = Number.isInteger(state.answers[nextQuestion.id]);
  return { ...state, questionIndex: nextIndex, navigationMode: nextAnswered ? "review" : "auto", error: null };
}
```

Export all three helpers.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
node --test miniprogram/tests/page-controller.test.js
```

Expected: all controller tests PASS.

- [ ] **Step 5: Write failing timer-adapter tests**

Extract timer orchestration into `miniprogram/pages/index/selection-flow.js` and test:

```js
test("a guarded continuation fires once after 280 ms", () => {
  const scheduled = [];
  const flow = createSelectionFlow({
    setTimer(fn, delay) { scheduled.push({ fn, delay }); return 7; },
    clearTimer() {}
  });
  let action = "";
  flow.schedule({ token: "u:5:1:0", action: "advance", run(value) { action = value; } });
  assert.equal(scheduled[0].delay, 280);
  scheduled[0].fn();
  assert.equal(action, "advance");
});

test("cancel prevents a previous-page continuation", () => {
  let cleared = null;
  const flow = createSelectionFlow({ setTimer() { return 9; }, clearTimer(id) { cleared = id; } });
  flow.schedule({ token: "u:5:1:4", action: "advance", run() {} });
  flow.cancel();
  assert.equal(cleared, 9);
});
```

- [ ] **Step 6: Run timer tests and verify RED**

Run:

```powershell
node --test miniprogram/tests/selection-flow.test.js
```

Expected: FAIL because `selection-flow.js` is missing.

- [ ] **Step 7: Implement timer ownership and page integration**

Create `selection-flow.js`:

```js
function createSelectionFlow({ setTimer, clearTimer, delay = 280 }) {
  let timerId = null;
  let generation = 0;
  return {
    cancel() {
      generation += 1;
      if (timerId !== null) clearTimer(timerId);
      timerId = null;
    },
    schedule({ token, action, run }) {
      this.cancel();
      const scheduledGeneration = generation;
      timerId = setTimer(() => {
        timerId = null;
        if (scheduledGeneration !== generation) return;
        run(action, token);
      }, delay);
    }
  };
}
module.exports = { createSelectionFlow };
```

In `index.js`:

- initialize the flow in `onLoad` with `setTimeout`/`clearTimeout`;
- cancel it in `onUnload`, version changes, Previous, restart, welcome/identity navigation, and submission;
- capture `wasAnswered`, operation generation, question index, and selected answer before scheduling;
- after 280 ms, verify all captured values; then call `nextQuestionState` or `finishQuiz`;
- call `wx.pageScrollTo({ scrollTop: 0, duration: 0 })` after accepted navigation;
- expose `showManualNext: state.navigationMode === "review"` in view data.

In WXML, keep Previous and render Next only in review mode:

```xml
<view class="quiz-footer">
  <button class="text-button" disabled="{{!canGoPrevious}}" bindtap="previousQuestion">← 上一题</button>
  <button wx:if="{{showManualNext}}" class="primary-button compact" bindtap="nextQuestion">
    {{questionNumber === questionTotal ? '查看结果' : '下一题 →'}}
  </button>
</view>
```

- [ ] **Step 8: Run native tests**

Run:

```powershell
node --test miniprogram/tests/*.test.js
```

Expected: all native tests PASS, including selection-flow tests.

- [ ] **Step 9: Commit**

```powershell
git add SCTI_Study/miniprogram/pages/index SCTI_Study/miniprogram/tests
git commit -m "feat: match native quiz navigation behavior"
```

---

### Task 3: Add local-service health and boundary-specific recovery

**Files:**
- Modify: `frontend-demo/dev-server.mjs`
- Modify: `frontend-demo/tests/dev-server.test.mjs`
- Modify: `miniprogram/services/quiz-service.js`
- Modify: `miniprogram/tests/quiz-service.test.js`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`

**Interfaces:**
- Produces: `GET /api/health -> { code: 0, data: { mode: "local" } }`.
- Produces: `healthEndpoint(resultEndpoint) -> local health URL` without relying on the browser-only `URL` global.
- Produces: `quizService.checkHealth() -> { status: "connected" | "blocked" | "offline", message: string }`.

- [ ] **Step 1: Write failing server health test**

```js
test("local server exposes a health boundary", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: { mode: "local" } });
});
```

- [ ] **Step 2: Run frontend test and verify RED**

Run:

```powershell
cd frontend-demo
node --test tests/dev-server.test.mjs
```

Expected: FAIL with HTTP 404 for `/api/health`.

- [ ] **Step 3: Implement health route**

Before static serving in `createDemoServer`:

```js
if (request.method === "GET" && request.url === "/api/health") {
  sendJson(response, 200, { code: 0, data: { mode: "local" } });
  return;
}
```

- [ ] **Step 4: Write failing native classification tests**

```js
test("health classifies DevTools domain blocking separately", async () => {
  const service = createQuizService({
    wxApi: { request({ fail }) { fail({ errMsg: "request:fail url not in domain list" }); } },
    runtimeConfig: localConfig,
    nativeRuntime: fixtureRuntime
  });
  assert.deepEqual(await service.checkHealth(), {
    status: "blocked",
    message: "开发者工具已拦截本地地址，请仅在本地调试时关闭合法域名校验"
  });
});

test("health reports an offline computer service", async () => {
  const service = createQuizService({
    wxApi: { request({ fail }) { fail({ errMsg: "request:fail connect ECONNREFUSED" }); } },
    runtimeConfig: localConfig,
    nativeRuntime: fixtureRuntime
  });
  assert.equal((await service.checkHealth()).status, "offline");
});

test("health endpoint is derived from the configured submit endpoint", () => {
  assert.equal(
    healthEndpoint("http://127.0.0.1:4175/api/submit-quiz"),
    "http://127.0.0.1:4175/api/health"
  );
});
```

- [ ] **Step 5: Run native service test and verify RED**

Run:

```powershell
node --test miniprogram/tests/quiz-service.test.js
```

Expected: FAIL because `checkHealth` is missing.

- [ ] **Step 6: Implement `checkHealth` and page status**

Add a runtime-safe pure helper and use it for the GET request with the configured timeout:

```js
function healthEndpoint(resultEndpoint) {
  return String(resultEndpoint).replace(/\/api\/submit-quiz(?:\?.*)?$/, "/api/health");
}
```

Do not use the browser `URL` global because it is not guaranteed in the Mini Program JavaScript runtime. Classify `/not in domain list|合法域名|url check/i` as `blocked`; all other request failures as `offline`. Cloud mode returns:

```js
{ status: "cloud", message: "云端结果服务" }
```

Add page view fields:

```js
serviceStatus: "checking",
serviceMessage: "正在检查本地结果服务"
```

Call `checkHealth()` on load and when the user taps a new `retryServiceHealth` action. Ignore stale completion after mode/version generation changes.

Render on welcome and identity:

```xml
<view wx:if="{{localMode}}" class="service-chip service-{{serviceStatus}}">
  <text>{{serviceMessage}}</text>
  <button wx:if="{{serviceStatus !== 'connected' && serviceStatus !== 'checking'}}" bindtap="retryServiceHealth">重新检查</button>
</view>
```

- [ ] **Step 7: Run focused and full tests**

Run:

```powershell
cd frontend-demo
npm.cmd test
cd ..
node --test miniprogram/tests/*.test.js
```

Expected: frontend and native suites PASS.

- [ ] **Step 8: Commit**

```powershell
git add SCTI_Study/frontend-demo/dev-server.mjs SCTI_Study/frontend-demo/tests SCTI_Study/miniprogram/services SCTI_Study/miniprogram/pages/index SCTI_Study/miniprogram/tests
git commit -m "feat: diagnose native local result service"
```

---

### Task 4: Port the frontend-demo mobile visual system into native WXML/WXSS

**Files:**
- Modify: `miniprogram/app.wxss`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `scripts/validate-mini-program.mjs`
- Modify: `miniprogram/tests/page-controller.test.js`

**Interfaces:**
- Consumes: Task 1 component specs and current dynamic page view model.
- Produces: browser-parity native states with no hard-coded canonical content.

- [ ] **Step 1: Add failing structural assertions**

Extend `validate-mini-program.mjs` to require these native parity classes:

```js
const requiredClasses = [
  "welcome-top", "welcome-copy", "campus-art", "hero-card",
  "identity-list", "quiz-topline", "question-card", "option-list",
  "analysis-steps", "result-hero", "result-card", "service-chip"
];
for (const className of requiredClasses) {
  if (!wxml.includes(className)) throw new Error(`native page missing parity class: ${className}`);
}
```

Also assert source excludes `.prototype-intro`, `.phone-device`, and hard-coded question IDs.

- [ ] **Step 2: Run validator and verify RED**

Run:

```powershell
node scripts/validate-mini-program.mjs
```

Expected: FAIL because `welcome-top`, `welcome-copy`, `campus-art`, `hero-card`, and `service-chip` are absent.

- [ ] **Step 3: Port welcome and identity structure**

Replace the simplified welcome doodles with native equivalents of the source hierarchy:

```xml
<view class="welcome-top">
  <view class="brand-mark"><text class="brand-icon">✦</text><text>校园人设实验室</text></view>
  <text class="mini-version">三版本 · V5</text>
</view>
<view class="welcome-copy">
  <text class="section-label">高中版 · 大学版 · 硕博版</text>
  <text class="hero-title">测测你是哪种</text>
  <text class="hero-title scribble">校园人设？</text>
  <text class="hero-subtitle">选择当前校园阶段，完成 20 道校园场景题。</text>
</view>
<view class="campus-art" aria-hidden="true">
  <view class="art-ground"></view><view class="art-tree"></view>
  <view class="student student-one"><text class="student-head">◡</text><view class="student-body"></view></view>
  <view class="student student-two"><text class="student-head">◡</text><view class="student-body"></view></view>
  <view class="student student-three"><text class="student-head">◡</text><view class="student-body"></view></view>
</view>
```

Keep identity cards generated from `versions`; match the source icon/name/description/checkmark hierarchy and version theme variables.

- [ ] **Step 4: Port quiz, analysis, result, and share structure**

Use the exact source hierarchy recorded in specs. Preserve dynamic bindings for `question`, `options`, `result`, `descriptions`, and `dimensionRows`. Do not copy browser tab controls or modal-only demo copy. Keep native `open-type="share"`.

- [ ] **Step 5: Port design tokens and component metrics**

Define native tokens:

```css
.page-shell {
  --paper: #fffdf3;
  --ink: #171717;
  --muted: #77756f;
  --mint: #82ebc6;
  --mint-light: #e7ffe9;
  --yellow: #fff1a6;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
}
```

Translate each source component value from the Task 1 specs. Keep 4 px-equivalent major outlines, 28 px-equivalent cards, pill buttons, source font hierarchy, and source shadow proportions. Use flex instead of unsupported CSS grid for dimension rows.

- [ ] **Step 6: Run native static and controller tests**

Run:

```powershell
node scripts/validate-mini-program.mjs
node --test miniprogram/tests/*.test.js
```

Expected: validator and all native tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add SCTI_Study/miniprogram/app.wxss SCTI_Study/miniprogram/pages/index SCTI_Study/miniprogram/tests SCTI_Study/scripts/validate-mini-program.mjs
git commit -m "feat: port frontend demo visuals to native"
```

---

### Task 5: Add configurable result-character presentation

**Files:**
- Create: `data/persona-presentation.v1.json`
- Create: `schemas/persona-presentation.schema.json`
- Modify: `scripts/validate-question-banks.mjs`
- Modify: `tests/question-banks.test.js`
- Modify: `campus_persona/scripts/build-question-banks.mjs`
- Modify: `campus_persona/tests/build-question-banks.test.js`
- Create: `miniprogram/utils/persona-presentation.js`
- Create: `miniprogram/tests/persona-presentation.test.js`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`

**Interfaces:**
- Canonical public config: `{ version, default, tags }`.
- Produces: `validatePersonaPresentation(presentation)` in the root data-validation boundary.
- Produces: `resolvePersonaPresentation(config, version, tagId, fallbackIcon)`.

- [ ] **Step 1: Write failing presentation resolution tests**

```js
test("version-tag presentation wins and missing art falls back safely", () => {
  const config = {
    version: "1.0.0",
    default: { character_image: "", character_alt: "校园人设角色", decorations: [] },
    tags: {
      "university:example-tag": {
        character_image: "/assets/personas/example-tag.webp",
        character_alt: "示例校园角色",
        decorations: ["star"]
      }
    }
  };
  assert.equal(resolvePersonaPresentation(config, "university", "example-tag", "🎓").character_image, "/assets/personas/example-tag.webp");
  assert.equal(resolvePersonaPresentation(config, "graduate", "missing", "🔬").fallback_icon, "🔬");
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```powershell
node --test miniprogram/tests/persona-presentation.test.js
```

Expected: FAIL because resolver/config are missing.

- [ ] **Step 3: Add schema and canonical default configuration**

Create `data/persona-presentation.v1.json`:

```json
{
  "version": "1.0.0",
  "default": {
    "character_image": "",
    "character_alt": "校园人设角色",
    "character_position": "center bottom",
    "decorations": []
  },
  "tags": {}
}
```

Schema and root validator rules:

- `version`, `default`, and `tags` required;
- `version` is semantic-version shaped;
- tag keys match `^[a-z][a-z0-9_]*:[A-Z][A-Z0-9]{0,7}$`;
- each entry permits only `character_image`, `character_alt`, `character_position`, and `decorations`;
- image paths are empty or begin `/assets/personas/` and end `.png`/`.webp`;
- decorations are unique nonempty strings;
- no additional properties.

Extend `loadConfiguredData()` to load `data/persona-presentation.v1.json`, call `validatePersonaPresentation()` from the validator CLI, and export the validator for tests. Add a malformed fixture assertion proving an image outside `/assets/personas/` is rejected before generation.

- [ ] **Step 4: Generate presentation into native runtime**

Extend native runtime payload from `{ registry, banks }` to:

```js
{ registry, banks, presentation }
```

Add builder tests asserting the payload includes public presentation and still excludes private scoring fields.

- [ ] **Step 5: Implement resolver and result binding**

```js
function resolvePersonaPresentation(config, version, tagId, fallbackIcon) {
  const key = `${version}:${tagId}`;
  const selected = config?.tags?.[key] || config?.default || {};
  return {
    character_image: selected.character_image || "",
    character_alt: selected.character_alt || "校园人设角色",
    character_position: selected.character_position || "center bottom",
    decorations: Array.isArray(selected.decorations) ? selected.decorations : [],
    fallback_icon: fallbackIcon || "✦"
  };
}
module.exports = { resolvePersonaPresentation };
```

Bind result view data as `character`. Render `<image wx:if="{{character.character_image}}">`; otherwise render `character.fallback_icon` in the same hero slot.

- [ ] **Step 6: Build and verify**

Run:

```powershell
cd campus_persona
npm.cmd run build:banks
node --test tests/build-question-banks.test.js
cd ..
node --test miniprogram/tests/*.test.js
node scripts/validate-mini-program.mjs
```

Expected: build emits three banks plus presentation; focused and native tests PASS; private-field scans remain empty.

- [ ] **Step 7: Commit**

```powershell
git add SCTI_Study/data/persona-presentation.v1.json SCTI_Study/schemas/persona-presentation.schema.json SCTI_Study/scripts/validate-question-banks.mjs SCTI_Study/tests/question-banks.test.js SCTI_Study/campus_persona/scripts SCTI_Study/campus_persona/tests SCTI_Study/miniprogram
git commit -m "feat: configure native result character art"
```

---

### Task 6: Full verification, E-drive sync, and DevTools visual acceptance

**Files:**
- Create: `docs/superpowers/reports/frontend-demo-native-parity-builder.md`
- Sync reviewed tracked files to: `E:\\SCTI_Study`
- Preserve locally: `project.config.json`, `project.private.config.json`, AppID, `.env*`, `.codex/`, and runtime data.

**Interfaces:**
- Produces: verified E-drive native client and evidence report.

- [ ] **Step 1: Run complete automated verification in the Git worktree**

Run separately and retain exact counts:

```powershell
node scripts/validate-question-banks.mjs
node --test tests/question-banks.test.js
node scripts/validate-mini-program.mjs
cd campus_persona
npm.cmd run build:banks
npm.cmd test
node --test --test-name-pattern="changing only Q20" tests/algorithm.test.js
cd ..\frontend-demo
npm.cmd test
cd ..
node --test miniprogram/tests/*.test.js
git diff --check
git status --short
```

Expected: every command exits 0; Q20 isolation passes for all three versions; worktree contains only the planned report before its commit.

- [ ] **Step 2: Run privacy and source-boundary scans**

```powershell
rg -n '"scores"|core_questions|algorithm_profile|scores_ranking|target_vector' miniprogram/data miniprogram/pages miniprogram/services miniprogram/utils miniprogram/config
rg --pcre2 -n 'OPENID_HMAC_SECRET\s*[:=]\s*["''][^"'']+["'']|appsecret\s*[:=]\s*["''][^"'']+["'']' . -g '!node_modules/**'
```

Expected: zero runtime private matches and zero secret assignments.

- [ ] **Step 3: Perform independent read-only review**

Review feature commits against the approved design. Reject and fix any Critical or Important issue before syncing. Confirm no canonical bank or algorithm file changed except generated presentation linkage.

- [ ] **Step 4: Synchronize reviewed tracked files to E drive**

Derive a manifest from Git-tracked `SCTI_Study/` files. Copy only changed/new tracked files. Exclude:

```text
AGENTS.md
.codex/
.env*
memory_data/
knowledge_base/
project.config.json
project.private.config.json
```

Verify source and target SHA-256 for every copied file.

- [ ] **Step 5: Start local server and confirm health**

Run:

```powershell
cd E:\SCTI_Study\frontend-demo
npm.cmd start
```

Confirm both URLs return HTTP 200:

```text
http://127.0.0.1:4175/
http://127.0.0.1:4175/api/health
```

Retain the exact Node PID for safe shutdown.

- [ ] **Step 6: Compile in the already-open WeChat DevTools**

Recompile `E:\SCTI_Study`. Verify:

- no `app.json`, WXML, WXSS, or JavaScript compiler errors;
- welcome and identity states match the browser-demo mobile hierarchy;
- all three identity cards are visible;
- local service chip reports connected, or precisely reports legal-domain blocking if the user has not disabled that local-only check.

- [ ] **Step 7: Verify interaction acceptance in DevTools**

For one complete version and focused checks on the other two:

1. Q1 first option tap selects and advances after about 280 ms.
2. Previous cancels any pending advance and enters review.
3. Changing a reviewed answer stays on the question.
4. Manual Next pages through answered questions.
5. First unanswered question resumes automatic advance.
6. Q20 contains sixteen options and submits to analysis/result.
7. Result renders persona copy, dimensions, self perception, character fallback/config slot, and native share button.
8. Switch to each remaining version and confirm Q1 content/theme plus Q20 structure through automated evidence.

- [ ] **Step 8: Perform visual QA**

Compare browser-demo mobile and native screenshots for welcome, identity, quiz, analysis, and result. Record discrepancies by component. Fix structural/color/spacing differences that are visible at the 390 px reference size, then rerun native tests and DevTools compilation.

- [ ] **Step 9: Record evidence and commit report**

Document exact test counts, privacy results, sync hashes, DevTools compilation, interaction checks, visual discrepancies fixed, and any remaining user-only legal-domain setting.

```powershell
git add SCTI_Study/docs/superpowers/reports/frontend-demo-native-parity-builder.md
git commit -m "test: verify frontend demo native parity"
```

## Execution Gates

Execute Tasks 1-6 in order. Each behavior task uses RED, minimal GREEN, full suite, self-review, and commit. Only Task 6 synchronizes to `E:\\SCTI_Study`; do not place partial changes into the user's active DevTools project.
