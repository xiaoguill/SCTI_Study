const test = require("node:test");
const assert = require("node:assert/strict");
const { buildResultPosterModel } = require("../utils/result-poster-model");

test("poster model contains immutable public render fields and no scoring data", () => {
  const result = {
    tag_id: "G2", tag_name: "学术哈喽", tag_short_desc: "短描述", keywords: ["#研究"],
    share_copy: "分享文案", scores_ranking: { hidden: true }
  };
  const presentation = {
    character_image: "/assets/personas/graduate/g2.png", character_position: "center_bottom",
    character_scale: 1, hero_background: "#f7f0e3", poster: { template_key: "persona-result-v1", character_position: "center_bottom", safe_area: "center" }
  };
  const version = { id: "graduate", title: "硕博版", theme: { accent: "#123456" } };
  const model = buildResultPosterModel(result, presentation, version);
  assert.deepEqual(model, {
    template_key: "persona-result-v1", safe_area: "center", version_id: "graduate", version_title: "硕博版",
    theme_color: "#123456", hero_background: "#f7f0e3", tag_id: "G2", tag_name: "学术哈喽",
    tag_short_desc: "短描述", keywords: ["#研究"], character_image: "/assets/personas/graduate/g2.png",
    character_position: "center_bottom", character_scale: 1, share_copy: "分享文案", qr_payload: ""
  });
  assert.equal(JSON.stringify(model).includes("scores"), false);
  assert.ok(Object.isFrozen(model));
});

test("poster model takes character position only from poster configuration", () => {
  const model = buildResultPosterModel(
    { tag_id: "G2", tag_name: "学术吗喽", tag_short_desc: "短描述", keywords: [], share_copy: "分享" },
    {
      character_image: "/assets/personas/graduate/g2.png",
      character_position: "left_bottom",
      character_scale: 1,
      hero_background: "#f7f0e3",
      poster: { template_key: "persona-result-v1", character_position: "right_bottom", safe_area: "center" }
    },
    { id: "graduate", title: "硕博版", theme: { accent: "#123456" } }
  );
  assert.equal(model.character_position, "right_bottom");
});
