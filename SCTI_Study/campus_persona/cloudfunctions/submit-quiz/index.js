const crypto = require("crypto");
const cloud = require("wx-server-sdk");
const bank = require("./university-bank.json");
const { calculateResult, validateAnswers } = require("./algorithm");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function error(code, message) {
  return { code, message, data: null };
}

function identityHash(platform) {
  const secret = process.env.OPENID_HMAC_SECRET;
  const context = cloud.getWXContext();
  if (!secret || !context.OPENID) throw new Error("CloudBase identity configuration is missing");
  return crypto.createHmac("sha256", secret).update(`${platform}:${context.OPENID}`).digest("hex");
}

async function ensureUser(platform) {
  const providerSubjectHash = identityHash(platform);
  const collection = db.collection("users");
  const existing = await collection.where({ provider_subject_hash: providerSubjectHash, platform }).limit(1).get();
  if (existing.data.length) return { userId: existing.data[0]._id, isNewUser: false };
  const now = new Date();
  const created = await collection.add({ data: {
    provider_subject_hash: providerSubjectHash,
    platform,
    identity_type: "university",
    last_test_tag: null,
    test_count: 0,
    created_at: now,
    updated_at: now
  } });
  return { userId: created._id, isNewUser: true };
}

exports.main = async (event = {}) => {
  try {
    if (event.version !== "university") return error(404, "仅支持大学版 MVP");
    const answers = event.answers;
    validateAnswers(answers, bank);
    const { userId } = await ensureUser("wechat");
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recent = await db.collection("quiz_records").where({ user_id: userId, version: "university", created_at: _.gt(fiveMinutesAgo) }).count();
    if (recent.total >= 3) return error(429, "测试次数过于频繁，请稍后再试");

    const serverResult = calculateResult(answers, bank);
    const now = new Date();
    const record = await db.collection("quiz_records").add({ data: {
      user_id: userId,
      version: "university",
      version_number: bank.bank_version,
      answers: answers.map(({ qid, selected }) => ({ qid, selected })),
      result: serverResult,
      duration_seconds: Number.isFinite(event.duration_seconds) ? event.duration_seconds : null,
      created_at: now
    } });

    await db.collection("users").doc(userId).update({ data: {
      last_test_tag: serverResult.tag_id,
      test_count: _.inc(1),
      updated_at: now
    } });

    const totalTested = await db.collection("quiz_records").where({ version: "university" }).count();
    const thisTagCount = await db.collection("quiz_records").where({ version: "university", "result.tag_id": serverResult.tag_id }).count();
    return {
      code: 0,
      message: "success",
      data: {
        record_id: record._id,
        server_result: serverResult,
        match_confirmed: true,
        tag_stats: {
          total_tested: totalTested.total,
          this_tag_count: thisTagCount.total,
          this_tag_percentage: totalTested.total ? Number((thisTagCount.total / totalTested.total * 100).toFixed(1)) : 0
        }
      }
    };
  } catch (err) {
    console.error("submit-quiz failed");
    if (err.message.includes("answers")) return error(400, "答题数据不完整或格式错误");
    if (err.message.includes("identity configuration")) return error(500, "云开发身份配置缺失");
    return error(500, "系统繁忙，请稍后再试");
  }
};
