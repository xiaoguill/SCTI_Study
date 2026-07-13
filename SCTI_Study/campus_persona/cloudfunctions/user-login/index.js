const crypto = require("crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function identityHash(platform) {
  const secret = process.env.OPENID_HMAC_SECRET;
  const context = cloud.getWXContext();
  if (!secret || !context.OPENID) throw new Error("CloudBase identity configuration is missing");
  return crypto.createHmac("sha256", secret).update(`${platform}:${context.OPENID}`).digest("hex");
}

exports.main = async (event = {}) => {
  try {
    const platform = event.platform || "wechat";
    if (platform !== "wechat") return { code: 404, message: "当前 MVP 只支持微信", data: null };
    const providerSubjectHash = identityHash(platform);
    const users = db.collection("users");
    const existing = await users.where({ provider_subject_hash: providerSubjectHash, platform }).limit(1).get();
    if (existing.data.length) {
      return { code: 0, message: "success", data: { user_id: existing.data[0]._id, is_new_user: false } };
    }
    const now = new Date();
    const created = await users.add({ data: {
      provider_subject_hash: providerSubjectHash,
      platform,
      identity_type: "university",
      last_test_tag: null,
      test_count: 0,
      created_at: now,
      updated_at: now
    } });
    return { code: 0, message: "success", data: { user_id: created._id, is_new_user: true } };
  } catch (err) {
    console.error("user-login failed");
    return { code: 500, message: "登录服务暂不可用", data: null };
  }
};
