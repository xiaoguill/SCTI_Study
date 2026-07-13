const PUBLIC_BANK_URL = "./data/university-bank.public.json";
let cachedBank = null;

function hasWechatCloud() {
  return typeof wx !== "undefined" && wx.cloud && typeof wx.cloud.callFunction === "function";
}

async function callWechatFunction(name, data) {
  const response = await wx.cloud.callFunction({ name, data });
  return response.result;
}

export async function getBank() {
  if (cachedBank) return cachedBank;
  if (hasWechatCloud()) {
    const response = await callWechatFunction("get-bank", { version: "university", client_bank_version: "" });
    if (response.code !== 0) throw new Error(response.message || "题库加载失败");
    cachedBank = response.data;
    return cachedBank;
  }
  const response = await fetch(PUBLIC_BANK_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("本地题库加载失败");
  cachedBank = await response.json();
  return cachedBank;
}

function localDemoSubmit(data, bank) {
  const q20 = data.answers.find((answer) => answer.qid === 20);
  const tag = bank.tags[q20?.selected ?? 5] || bank.tags[5];
  const eggs = [5, 8, 12, 19].flatMap((qid) => {
    const answer = data.answers.find((item) => item.qid === qid);
    const question = bank.questions.find((item) => item.id === qid);
    const option = question?.options[answer?.selected ?? 0];
    const mapping = bank.easter_eggs.find((item) => item.source_qid === qid)?.option_mapping[answer?.selected ?? 0];
    return mapping ? [{ qid, value: mapping.desc || option?.text || "" }] : [];
  });
  const userVector = tag.dimensions || [3, 3, 3, 3];
  return {
    code: 0,
    message: "local demo",
    data: {
      record_id: "local-demo-record",
      server_result: {
        tag_id: tag.id,
        tag_name: tag.name,
        tag_short_desc: tag.short_desc,
        tag_full_desc: tag.full_desc,
        keywords: tag.keywords,
        match_method: "local_demo",
        scores_ranking: [],
        dimensions: {
          labels: Object.values(bank.dimension_config),
          user_vector: userVector,
          target_vector: tag.dimensions,
          manhattan_distance: 0
        },
        easter_eggs: eggs
      },
      match_confirmed: false,
      tag_stats: { total_tested: 0, this_tag_count: 0, this_tag_percentage: 0 }
    }
  };
}

export async function submitQuiz(data, bank) {
  if (hasWechatCloud()) return callWechatFunction("submit-quiz", data);
  return localDemoSubmit(data, bank);
}

export async function recordShare(data) {
  if (hasWechatCloud()) return callWechatFunction("record-share", data);
  return { code: 0, message: "local demo", data: { share_record_id: "local-demo-share" } };
}

export async function login() {
  if (hasWechatCloud()) return callWechatFunction("user-login", { platform: "wechat" });
  return { code: 0, message: "local demo", data: { user_id: "local-demo-user", is_new_user: true } };
}
