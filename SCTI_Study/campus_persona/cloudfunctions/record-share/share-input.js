function normalizeShareRequest(event = {}) {
  const recordId = typeof event.record_id === "string" ? event.record_id.trim() : "";
  const shareType = event.share_type || "forward";
  if (!recordId || !["forward", "timeline"].includes(shareType)) {
    throw new Error("invalid share request");
  }
  return { recordId, shareType, sharePlatform: "wechat" };
}

module.exports = { normalizeShareRequest };
