const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { resolvePersonaPresentation } = require("../utils/persona-presentation");
const runtime = require("../data/runtime");

let pageDefinition;
const previousPage = global.Page;
global.Page = (definition) => {
  pageDefinition = definition;
};
require("../pages/index/index");
if (previousPage === undefined) delete global.Page;
else global.Page = previousPage;

function resultState(versionId, tagId) {
  const versions = runtime.registry.versions.filter(({ enabled }) => enabled);
  const activeVersion = versions.find(({ id }) => id === versionId);
  return {
    registry: runtime.registry,
    versions,
    activeVersion,
    bank: runtime.banks[versionId],
    screen: "result",
    questionIndex: 0,
    answers: {},
    navigationMode: "auto",
    submitting: false,
    error: null,
    result: {
      tag_id: tagId,
      tag_full_desc: {
        paragraph_1: "第一段完整结果说明文字。",
        paragraph_2: "第二段完整结果说明文字。",
        paragraph_3: "第三段完整结果说明文字。"
      },
      dimensions: {
        labels: ["投入度", "社交度", "执行力", "开放性"],
        user_vector: [4, 3, 4, 3]
      }
    }
  };
}

function pageView(state) {
  return {
    ...pageDefinition,
    runtimeState: state,
    data: { ...pageDefinition.data },
    setData(update) {
      Object.assign(this.data, update);
    }
  };
}

test("exact version-tag presentation takes precedence over configured default", () => {
  const config = {
    version: "1.0.0",
    default: {
      character_image: "/assets/personas/default.webp",
      character_alt: "默认校园角色",
      character_position: "left bottom",
      decorations: ["moon"]
    },
    tags: {
      "university:U1": {
        character_image: "/assets/personas/university/u1.webp",
        character_alt: "大学校园角色",
        decorations: ["star"]
      }
    }
  };

  const selected = resolvePersonaPresentation(config, "university", "U1", "🎓");
  assert.equal(selected.character_image, "/assets/personas/university/u1.webp");
  assert.equal(selected.character_alt, "大学校园角色");
  assert.equal(selected.character_position, "center_bottom");
  assert.deepEqual(selected.decorations, ["star"]);
  assert.equal(selected.fallback_icon, "🎓");
});

test("configured default takes precedence when the exact version-tag key is absent", () => {
  const config = {
    version: "1.0.0",
    default: {
      character_image: "/assets/personas/default.webp",
      character_alt: "默认校园角色",
      character_position: "left bottom",
      decorations: ["moon"]
    },
    tags: {}
  };

  const missing = resolvePersonaPresentation(config, "graduate", "G1", "🔬");
  assert.equal(missing.character_image, "/assets/personas/default.webp");
  assert.equal(missing.character_alt, "默认校园角色");
  assert.equal(missing.character_position, "center_bottom");
  assert.deepEqual(missing.decorations, []);
  assert.equal(missing.fallback_icon, "🔬");
});

test("undefined config resolves to built-in safe presentation fallback", () => {
  assert.deepEqual(resolvePersonaPresentation(undefined, "graduate", "G1", undefined), {
    character_image: "",
    character_alt: "校园人设角色",
    character_position: "center_bottom",
    character_scale: 1,
    hero_background: "#f7f0e3",
    decorations: [],
    visual_brief: "",
    asset_status: "placeholder",
    poster: {},
    fallback_icon: "✦"
  });
});

test("resolver exposes complete native hero controls and keeps only supported decorations", () => {
  const model = resolvePersonaPresentation({
    default: {
      character_image: "",
      character_alt: "fallback",
      character_position: "center_bottom",
      character_scale: 1,
      hero_background: "#f7f0e3",
      decorations: [],
      visual_brief: "fallback",
      asset_status: "placeholder",
      poster: { template_key: "persona-result-v1", safe_area: "center" }
    },
    tags: {
      "graduate:G2": {
        character_image: "/assets/personas/graduate/g2.png",
        character_alt: "G2",
        character_position: "center_bottom",
        character_scale: 1.2,
        hero_background: "#f7f0e3",
        decorations: ["sparkle", "unsupported"],
        visual_brief: "G2",
        asset_status: "approved",
        poster: { template_key: "persona-result-v1", safe_area: "center" }
      }
    }
  }, "graduate", "G2", "🔬");
  assert.equal(model.character_scale, 1.2);
  assert.equal(model.hero_background, "#f7f0e3");
  assert.deepEqual(model.decorations, ["sparkle"]);
  assert.equal(model.poster.template_key, "persona-result-v1");
});

test("tag poster override inherits complete default poster fields", () => {
  const model = resolvePersonaPresentation({
    default: {
      character_image: "", character_alt: "默认", character_position: "left_bottom", character_scale: 1,
      hero_background: "#f7f0e3", decorations: [], visual_brief: "默认", asset_status: "placeholder",
      poster: { template_key: "persona-result-v1", character_position: "center_bottom", safe_area: "center" }
    },
    tags: { "graduate:G2": { poster: { character_position: "right_bottom" } } }
  }, "graduate", "G2", "🔬");
  assert.deepEqual(model.poster, {
    template_key: "persona-result-v1", character_position: "right_bottom", safe_area: "center"
  });
  assert.equal(model.character_position, "left_bottom");
});

test("delayed image errors clear only the current character source", () => {
  const page = pageView(resultState("graduate", "G2"));
  page.syncView();
  const current = page.data.character.character_image;
  page.handleCharacterError({ detail: { src: "/assets/personas/previous.png" } });
  assert.equal(page.data.character.character_image, current);
  page.handleCharacterError({ detail: { src: current } });
  assert.equal(page.data.character.character_image, "");
  assert.equal(page.data.result.tag_id, "G2");
});

test("result view binds version-tag art and renders fallback in the same hero slot", (t) => {
  const originalTags = runtime.presentation.tags;
  runtime.presentation.tags = {
    "university:U1": {
      character_image: "/assets/personas/university/u1.webp",
      character_alt: "大学校园角色",
      character_position: "center bottom",
      decorations: ["star"]
    }
  };
  t.after(() => {
    runtime.presentation.tags = originalTags;
  });

  const selectedPage = pageView(resultState("university", "U1"));
  selectedPage.syncView();
  assert.equal(selectedPage.data.character.character_image, "/assets/personas/university/u1.webp");
  assert.equal(selectedPage.data.character.fallback_icon, "🎓");

  const fallbackPage = pageView(resultState("graduate", "G1"));
  fallbackPage.syncView();
  assert.equal(fallbackPage.data.character.character_image, "");
  assert.equal(fallbackPage.data.character.fallback_icon, "🔬");

  const wxml = fs.readFileSync(path.resolve(__dirname, "../pages/index/index.wxml"), "utf8");
  assert.match(wxml, /<view wx:if="\{\{character\.character_image\}\}"/);
  assert.match(wxml, /src="\{\{character\.character_image\}\}"/);
  assert.match(wxml, /wx:else[^>]*>\{\{character\.fallback_icon\}\}/);
  assert.doesNotMatch(wxml, /\/assets\/personas\//);
});

test("same page clears previous artwork when the result version changes to fallback", (t) => {
  const originalTags = runtime.presentation.tags;
  runtime.presentation.tags = {
    "university:U1": {
      character_image: "/assets/personas/university/u1.webp",
      character_alt: "大学校园角色",
      character_position: "center bottom",
      decorations: []
    }
  };
  t.after(() => {
    runtime.presentation.tags = originalTags;
  });

  const page = pageView(resultState("university", "U1"));
  page.syncView();
  assert.equal(page.data.character.character_image, "/assets/personas/university/u1.webp");

  page.runtimeState = resultState("graduate", "G1");
  page.syncView();
  assert.equal(page.data.character.character_image, "");
  assert.equal(page.data.character.fallback_icon, "🔬");
});
