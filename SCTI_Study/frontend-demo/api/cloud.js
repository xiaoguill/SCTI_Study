const RESULT_TIMEOUT_MS = 12000;
const versionRegistryCache = new Map();
const bankCache = new Map();
const VERSION_REGISTRY_CACHE_KEY = "runtime-registry";

function hasWechatCloud() {
  return typeof wx !== "undefined" && wx.cloud && typeof wx.cloud.callFunction === "function";
}

async function callWechatFunction(name, data) {
  let response;
  try {
    response = await withTimeout(
      wx.cloud.callFunction({ name, data }),
      "云端服务暂不可用，请稍后重试"
    );
  } catch {
    throw new Error("云端服务暂不可用，请稍后重试");
  }
  if (!response?.result) throw new Error("云端服务暂不可用，请稍后重试");
  return response.result;
}

export function withTimeout(promise, message, timeoutMs = RESULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export async function getVersionRegistry() {
  const cachedRegistry = versionRegistryCache.get(VERSION_REGISTRY_CACHE_KEY);
  if (cachedRegistry) return cachedRegistry;
  if (hasWechatCloud()) {
    const response = await callWechatFunction("get-bank", { action: "versions" });
    if (response.code !== 0) throw new Error(response.message || "版本列表加载失败");
    versionRegistryCache.set(VERSION_REGISTRY_CACHE_KEY, response.data);
    return response.data;
  }
  const response = await fetch("./data/runtime-registry.json", { cache: "no-store" });
  if (!response.ok) throw new Error("本地版本列表加载失败");
  const registry = await response.json();
  versionRegistryCache.set(VERSION_REGISTRY_CACHE_KEY, registry);
  return registry;
}

function cachedBank(version, bankVersion) {
  if (bankVersion) return bankCache.get(`${version}:${bankVersion}`);
  for (const [key, bank] of bankCache) {
    if (key.startsWith(`${version}:`)) return bank;
  }
  return null;
}

export async function getBank(version, clientBankVersion = "") {
  if (typeof version !== "string" || !version.trim()) throw new Error("必须指定测试版本");
  const existingBank = cachedBank(version, clientBankVersion);
  if (existingBank) return existingBank;

  let bank;
  if (hasWechatCloud()) {
    const response = await callWechatFunction("get-bank", { version, client_bank_version: clientBankVersion });
    if (response.code !== 0) throw new Error(response.message || "题库加载失败");
    bank = response.data;
  } else {
    const registry = await getVersionRegistry();
    const versionConfig = registry.versions.find((item) => item.id === version && item.enabled);
    if (!versionConfig) throw new Error("该测试版本暂不可用");
    const response = await fetch(`./data/${versionConfig.public_bank_file}`, { cache: "no-store" });
    if (!response.ok) throw new Error("本地题库加载失败");
    bank = await response.json();
  }

  bankCache.set(`${version}:${bank.bank_version}`, bank);
  return bank;
}

export async function localDemoSubmit(data, { fetchImpl = fetch, timeoutMs = RESULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl("./api/submit-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "本地结果计算失败");
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("本地结果服务超时，请重试或运行 npm start");
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
