# Configurable Persona Result Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one configurable native WeChat result page for all 48 campus-persona labels, integrate the approved G2 character asset, align answer options with the question card, and expose a stable future poster-image model.

**Architecture:** Keep `data/persona-presentation.v1.json` as the presentation source of truth and compile it into the existing native runtime. Resolve a complete immutable presentation model from `version + tag_id`, render it in the existing result state, and isolate future poster generation behind a pure model builder. Preserve the current private scoring boundary and Q20 self-perception-only behavior.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/CommonJS, Node.js `node:test`, JSON Schema, existing Node build and validation scripts.

## Global Constraints

- Three versions share one result page and one presentation resolver.
- The canonical question banks and presentation JSON remain the only editable data sources; `miniprogram/data/runtime.js` remains generated.
- The client must not expose private scores, core questions, algorithm profiles, or target vectors.
- Q20 remains self-perception-only and must not affect the winning label or dimension vector.
- Missing or failed character images must fall back without hiding result copy.
- Result artwork, background, position, scale, decorations, and poster parameters must be configurable by `version:tag_id`.
- Initial approved real artwork is `graduate:G2`; the other 47 entries use safe placeholders until approved assets exist.
- The hero uses a warm light-beige background and keeps the character above centered copy.
- The future poster interface must not claim that image generation is complete.
- No new external dependency is introduced.
- The workspace is not currently a Git repository, so commit steps are recorded but cannot run until Git metadata exists.

---

### Task 1: Extend and validate the 48-label presentation source

**Files:**
- Modify: `schemas/persona-presentation.schema.json`
- Modify: `scripts/validate-question-banks.mjs`
- Modify: `data/persona-presentation.v1.json`
- Modify: `campus_persona/tests/question-bank-validation.test.js`

**Interfaces:**
- Consumes: enabled versions and tag IDs from `data/quiz-versions.v1.json` and `data/banks/*.json`.
- Produces: a presentation object with exactly one entry for each enabled `version:tag_id`, plus a complete default entry.

- [ ] **Step 1: Write failing validation tests**

Add tests that create presentation data missing one configured label and using invalid scale/status values:

```js
test("presentation covers every enabled bank tag", () => {
  const configured = loadConfiguredData();
  delete configured.presentation.tags["graduate:G16"];
  assert.throws(
    () => validateConfiguredPresentation(configured.registry, configured.banks, configured.presentation),
    /missing presentation key: graduate:G16/
  );
});

test("presentation rejects invalid display controls", () => {
  const configured = loadConfiguredData();
  configured.presentation.tags["graduate:G2"].character_scale = 3;
  assert.throws(() => validatePersonaPresentation(configured.presentation), /character_scale/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
cd E:\SCTI_Study\campus_persona
node --test tests\question-bank-validation.test.js
```

Expected: FAIL because coverage validation and the new fields do not exist.

- [ ] **Step 3: Extend the schema and validator**

Support these exact optional fields on each presentation entry:

```json
{
  "character_scale": 1,
  "hero_background": "#f7f0e3",
  "visual_brief": "人物、神态、姿势和一至三个核心道具的简洁说明",
  "asset_status": "placeholder",
  "poster": {
    "template_key": "persona-result-v1",
    "character_position": "center bottom",
    "safe_area": "center"
  }
}
```

Validation rules:

- `character_scale`: number from `0.5` through `1.5`.
- `hero_background`: `#RRGGBB`.
- `visual_brief`: non-empty string.
- `asset_status`: `placeholder`, `draft`, or `approved`.
- `poster`: object containing non-empty `template_key`, `character_position`, and `safe_area`.
- presentation keys must equal the full enabled-bank key set; extra or missing keys fail.

- [ ] **Step 4: Populate all 48 presentation entries**

Build the keys from the canonical banks:

```text
high_school:H1-H16
university:U1-U16
graduate:G1-G16
```

Each `visual_brief` must derive from that tag's canonical `name`, `short_desc`, and `portrait`, using the shared art rule: abstract low-poly paper figure, warm light-beige background, strong expression, one to three props, no complex room. Set G2 to `draft`; set the other 47 entries to `placeholder`.

- [ ] **Step 5: Run focused and canonical validation tests**

Run:

```powershell
cd E:\SCTI_Study
node scripts\validate-question-banks.mjs
cd campus_persona
npm.cmd test
```

Expected: all three banks report `20 questions, 16 tags`; presentation validation passes.

### Task 2: Add G2 artwork and rebuild native runtime

**Files:**
- Create: `miniprogram/assets/personas/graduate/g2.png`
- Modify: `data/persona-presentation.v1.json`
- Generated: `miniprogram/data/runtime.js`
- Modify: `campus_persona/tests/build-question-banks.test.js`

**Interfaces:**
- Consumes: approved G2 source image supplied by the user.
- Produces: package-local `/assets/personas/graduate/g2.png` and generated runtime presentation data.

- [ ] **Step 1: Write a failing artifact test**

```js
test("native runtime publishes G2 artwork without publishing private scoring fields", () => {
  const result = buildQuestionBanks({ write: false });
  const runtime = result.artifacts.find(({ file }) => file.endsWith("miniprogram\\data\\runtime.js"));
  assert.match(runtime.content, /\/assets\/personas\/graduate\/g2\.png/);
  assert.doesNotMatch(runtime.content, /scores_ranking|target_vector|core_questions/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
cd E:\SCTI_Study\campus_persona
node --test tests\build-question-banks.test.js
```

Expected: FAIL because the G2 path is absent.

- [ ] **Step 3: Copy and configure the approved asset**

Copy the supplied image to `miniprogram/assets/personas/graduate/g2.png`. Configure:

```json
{
  "character_image": "/assets/personas/graduate/g2.png",
  "character_alt": "学术吗喽低多边形人物",
  "character_position": "center bottom",
  "character_scale": 1,
  "hero_background": "#f7f0e3",
  "decorations": [],
  "asset_status": "approved"
}
```

- [ ] **Step 4: Rebuild runtime and verify GREEN**

Run:

```powershell
cd E:\SCTI_Study\campus_persona
npm.cmd run build:banks
node --test tests\build-question-banks.test.js
```

Expected: PASS and generated runtime contains the G2 public path.

### Task 3: Resolve complete presentation and handle image failures

**Files:**
- Modify: `miniprogram/utils/persona-presentation.js`
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/tests/persona-presentation.test.js`

**Interfaces:**
- Consumes: `resolvePersonaPresentation(config, version, tagId, fallbackIcon)`.
- Produces: `{ character_image, character_alt, character_position, character_scale, hero_background, decorations, asset_status, poster, fallback_icon }` and `handleCharacterError()`.

- [ ] **Step 1: Write failing resolver and failure-state tests**

```js
test("resolver returns complete configurable hero controls", () => {
  const model = resolvePersonaPresentation(config, "graduate", "G2", "🔬");
  assert.equal(model.hero_background, "#f7f0e3");
  assert.equal(model.character_scale, 1);
  assert.equal(model.poster.template_key, "persona-result-v1");
});

test("image error clears only the failed character image", () => {
  const page = pageView(resultState("graduate", "G2"));
  page.syncView();
  page.handleCharacterError();
  assert.equal(page.data.character.character_image, "");
  assert.equal(page.data.result.tag_id, "G2");
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
cd E:\SCTI_Study
node --test miniprogram\tests\persona-presentation.test.js
```

Expected: FAIL on missing fields and handler.

- [ ] **Step 3: Implement complete fallback resolution**

Merge exact entry over default and built-in fallback; never mutate runtime config. Bind `binderror="handleCharacterError"` to the hero image. The handler replaces only `data.character.character_image` with an empty string so the fallback icon renders.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
node --test E:\SCTI_Study\miniprogram\tests\persona-presentation.test.js
```

Expected: PASS.

### Task 4: Upgrade result hero and align question options

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/tests/index-page.test.js`
- Modify: `scripts/validate-mini-program.mjs`

**Interfaces:**
- Consumes: resolved `character`, existing `result`, `descriptions`, and `dimensionRows` page data.
- Produces: one scrollable result layout and one consistent question content width.

- [ ] **Step 1: Write failing structural tests**

Assert that:

```js
assert.match(wxml, /class="result-art-stage"/);
assert.match(wxml, /background:\{\{character.hero_background\}\}/);
assert.match(wxml, /binderror="handleCharacterError"/);
assert.match(wxss, /\.question-card,[\s\S]*\.option-list/);
assert.match(wxss, /\.option-button\s*\{[^}]*width:\s*100%/s);
assert.doesNotMatch(wxss, /\.option-list\s*\{[^}]*margin-(?:left|right):/s);
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test E:\SCTI_Study\miniprogram\tests\index-page.test.js
```

Expected: FAIL because the stage and alignment contract are absent.

- [ ] **Step 3: Implement the result-page structure**

Within the existing result scroll view, split the hero into:

```xml
<view class="result-hero">
  <view class="result-art-stage" style="background:{{character.hero_background}};">
    <image wx:if="{{character.character_image}}" binderror="handleCharacterError" ... />
    <view wx:else class="result-character-fallback">{{character.fallback_icon}}</view>
  </view>
  <view class="result-summary">
    <text class="result-name">{{result.tag_name}}</text>
    <text class="result-short-desc">{{result.tag_short_desc}}</text>
    <view class="tags">...</view>
  </view>
</view>
```

Keep all existing result sections and bottom actions below the hero. Use `#f7f0e3` as fallback background and center summary text.

- [ ] **Step 4: Implement answer alignment**

Apply one shared horizontal content width. Set `.option-list` and `.option-button` to `width: 100%`, remove narrowing margins, keep a fixed option-letter circle, and set option text to `flex: 1; min-width: 0; text-align: left;`. Preserve vertical scrolling for all 16 Q20 options.

- [ ] **Step 5: Run page tests and validator**

Run:

```powershell
cd E:\SCTI_Study
node --test miniprogram\tests\index-page.test.js miniprogram\tests\persona-presentation.test.js
node scripts\validate-mini-program.mjs
```

Expected: PASS.

### Task 5: Add the future poster-image model boundary

**Files:**
- Create: `miniprogram/utils/result-poster-model.js`
- Create: `miniprogram/tests/result-poster-model.test.js`
- Modify: `miniprogram/pages/index/index.js`

**Interfaces:**
- Produces: `buildResultPosterModel(result, presentation, version)`.
- Return shape: `{ template_key, version, tag_id, tag_name, tag_short_desc, keywords, character_image, character_position, hero_background, share_copy, qr_payload }`.

- [ ] **Step 1: Write a failing pure-model test**

```js
test("poster model contains public render data and no private scoring data", () => {
  const model = buildResultPosterModel(result, presentation, version);
  assert.equal(model.template_key, "persona-result-v1");
  assert.equal(model.tag_id, "G2");
  assert.equal(model.character_image, "/assets/personas/graduate/g2.png");
  assert.equal(JSON.stringify(model).includes("scores"), false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test E:\SCTI_Study\miniprogram\tests\result-poster-model.test.js
```

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the pure model builder**

Validate required public fields, copy arrays defensively, return an immutable plain object, and use an empty `qr_payload` until the future poster implementation supplies a scene value. Do not draw a canvas or request permissions in this task.

- [ ] **Step 4: Expose the model from the result action without claiming image completion**

Build and retain the poster model when the current result is valid. Keep the existing share behavior compatible. The future poster service will consume this model without reading page internals.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
node --test E:\SCTI_Study\miniprogram\tests\result-poster-model.test.js E:\SCTI_Study\miniprogram\tests\page-controller.test.js
```

Expected: PASS.

### Task 6: Full regression, build, and developer-tool verification

**Files:**
- Modify if required by verification only: `miniprogram/README.md`
- Verify: `project.config.json`
- Verify: `miniprogram/app.json`

**Interfaces:**
- Consumes all previous tasks.
- Produces evidence that data, native runtime, result flow, layout contract, and local build are ready before cloud deployment.

- [ ] **Step 1: Run all repository checks**

```powershell
cd E:\SCTI_Study
node scripts\validate-question-banks.mjs
node scripts\validate-mini-program.mjs
node --test miniprogram\tests\*.test.js
cd campus_persona
npm.cmd run build:banks
npm.cmd test
```

Expected: all commands exit `0`.

- [ ] **Step 2: Verify generated data and asset paths**

Confirm runtime contains 48 presentation keys, `graduate:G2` points to the packaged PNG, and no private fields appear in `miniprogram/data/runtime.js`.

- [ ] **Step 3: Compile in WeChat Developer Tools**

Open the existing project at `E:\SCTI_Study`, compile, and confirm there are no WXML/WXSS/JS errors.

- [ ] **Step 4: Exercise the three-version acceptance flow**

For each version, complete or restore a 20-answer test session, verify automatic transition into the result screen, verify Q20 appears only in the self-perception section, and verify the result page scrolls to the bottom actions.

- [ ] **Step 5: Verify visual acceptance points**

Confirm the G2 artwork uses the light-beige stage, missing assets use the fallback, result copy is centered below art, answer options align with the question card, and the 16 Q20 options remain usable.

- [ ] **Step 6: Record remaining external launch gates**

Document only the genuine external gates: CloudBase environment selection and deployment, legal-domain configuration if applicable, real-device/experience build testing, WeChat account certification, privacy/compliance review, review submission, and final publication.
