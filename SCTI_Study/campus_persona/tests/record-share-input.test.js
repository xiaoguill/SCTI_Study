const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeShareRequest } = require("../cloudfunctions/record-share/share-input");

test("share records accept only an owned record id and supported share type", () => {
  assert.deepEqual(
    normalizeShareRequest({ record_id: "record-1", share_type: "timeline" }),
    { recordId: "record-1", shareType: "timeline", sharePlatform: "wechat" }
  );
  assert.deepEqual(
    normalizeShareRequest({
      record_id: "record-2",
      share_type: "forward",
      tag_id: "FORGED",
      share_platform: "forged-platform"
    }),
    { recordId: "record-2", shareType: "forward", sharePlatform: "wechat" }
  );
});

test("share records reject malformed ids and unsupported share types", () => {
  assert.throws(() => normalizeShareRequest({ record_id: "", share_type: "forward" }), /share request/);
  assert.throws(() => normalizeShareRequest({ record_id: "record-1", share_type: "other" }), /share request/);
});
