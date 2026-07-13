const PUBLIC_BANK_URL = "./data/university-bank.public.json";
const RESULT_TIMEOUT_MS = 12000;
let cachedBank = null;

function hasWechatCloud() {
  return typeof wx !== "undefined" && wx.cloud && typeof wx.cloud.callFunction === "function";
}

async function callWechatFunction(name, data) {
  const response = await withTimeout(
    wx.cloud.callFunction({ name, data }),
    "云端计算超时，请检查网络后重试"
  );
  if (!response?.result) throw new Error("云端返回的数据不完整，请重试");
  return response.result;
}

function withTimeout(promise, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), RESULT_TIMEOUT_MS);
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
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

async function localDemoSubmit(data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESULT_TIMEOUT_MS);
  try {
    const response = await fetch("./api/submit-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "本地结果计算失败");
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("本地结果服务超时，请重试");
    if (error instanceof TypeError) throw new Error("本地结果服务不可用，请运行 npm start 后重试");
    if (error.message) throw error;
    throw new Error("本地结果服务不可用，请运行 npm start 后重试");
  } finally {
    clearTimeout(timer);
  }
}

export async function submitQuiz(data) {
  if (hasWechatCloud()) return callWechatFunction("submit-quiz", data);
  return localDemoSubmit(data);
}

export async function recordShare(data) {
  if (hasWechatCloud()) return callWechatFunction("record-share", data);
  return { code: 0, message: "local demo", data: { share_record_id: "local-demo-share" } };
}

export async function login() {
  if (hasWechatCloud()) return callWechatFunction("user-login", { platform: "wechat" });
  return { code: 0, message: "local demo", data: { user_id: "local-demo-user", is_new_user: true } };
}
