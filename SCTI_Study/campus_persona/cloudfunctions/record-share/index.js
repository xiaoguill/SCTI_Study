const crypto = require("crypto");
const cloud = require("wx-server-sdk");
const { normalizeShareRequest } = require("./share-input");

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
    let request;
    try {
      request = normalizeShareRequest(event);
    } catch {
      return { code: 400, message: "分享参数错误", data: null };
    }
    const { recordId, shareType, sharePlatform } = request;
    const providerSubjectHash = identityHash(sharePlatform);
    const user = await db.collection("users").where({ provider_subject_hash: providerSubjectHash, platform: sharePlatform }).limit(1).get();
    if (!user.data.length) return { code: 401, message: "请先登录", data: null };
    const record = await db.collection("quiz_records").where({ _id: recordId, user_id: user.data[0]._id }).limit(1).get();
    if (!record.data.length) return { code: 404, message: "结果不存在", data: null };
    const result = await db.collection("share_records").add({ data: {
      user_id: user.data[0]._id,
      quiz_record_id: recordId,
      share_type: shareType,
      share_platform: sharePlatform,
      tag_id: record.data[0].result.tag_id,
      created_at: new Date()
    } });
    return { code: 0, message: "success", data: { share_record_id: result._id } };
  } catch (err) {
    console.error("record-share failed");
    return { code: 500, message: "分享记录失败", data: null };
  }
};
