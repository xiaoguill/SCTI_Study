const { runtimeMode } = require("../config/runtime");
const { findVersion } = require("../utils/version-context");

function cloudResult(response) {
  const result = response?.result;
  if (!result) throw new Error("云端服务暂不可用，请稍后重试");
  if (result.code !== 0) throw new Error(result.message || "云端服务暂不可用，请稍后重试");
  return result;
}

function healthEndpoint(resultEndpoint) {
  return String(resultEndpoint).replace(/\/api\/submit-quiz(?:\?.*)?$/, "/api/health");
}

function createQuizService({ wxApi, runtimeConfig, nativeRuntime }) {
  const mode = runtimeMode(runtimeConfig);

  async function callCloud(name, data) {
    if (!wxApi?.cloud?.callFunction) throw new Error("云端服务暂不可用，请稍后重试");
    try {
      return cloudResult(await wxApi.cloud.callFunction({ name, data }));
    } catch (error) {
      if (error?.message && !/offline|cloud unavailable/i.test(error.message)) throw error;
      throw new Error("云端服务暂不可用，请稍后重试");
    }
  }

  function localRequest(data) {
    return new Promise((resolve, reject) => {
      if (typeof wxApi?.request !== "function") {
        reject(new Error("本地结果服务不可用，请运行 frontend-demo 的 npm start 后重试"));
        return;
      }
      wxApi.request({
        url: runtimeConfig.localResultEndpoint,
        method: "POST",
        data,
        timeout: runtimeConfig.requestTimeoutMs || 12000,
        header: { "content-type": "application/json" },
        success(response) {
          if (response.statusCode >= 200 && response.statusCode < 300 && response.data) {
            resolve(response.data);
            return;
          }
          reject(new Error(response.data?.message || "本地结果计算失败，请重试"));
        },
        fail(error) {
          const message = /timeout/i.test(error?.errMsg || "")
            ? "本地结果服务超时，请重试"
            : "本地结果服务不可用，请运行 frontend-demo 的 npm start 后重试";
          reject(new Error(message));
        }
      });
    });
  }

  function localHealthRequest() {
    return new Promise((resolve, reject) => {
      if (typeof wxApi?.request !== "function") {
        reject(new Error("本地结果服务不可用，请运行 frontend-demo 的 npm start 后重试"));
        return;
      }
      wxApi.request({
        url: healthEndpoint(runtimeConfig.localResultEndpoint),
        method: "GET",
        timeout: runtimeConfig.requestTimeoutMs || 12000,
        success(response) {
          if (response.statusCode >= 200 && response.statusCode < 300 && response.data?.code === 0) {
            resolve();
            return;
          }
          reject(new Error(response.data?.message || "本地结果服务不可用，请运行 frontend-demo 的 npm start 后重试"));
        },
        fail(error) {
          reject(error);
        }
      });
    });
  }

  return {
    async checkHealth() {
      if (mode === "cloud") return { status: "cloud", message: "云端结果服务" };
      try {
        await localHealthRequest();
        return { status: "connected", message: "本地结果服务已连接" };
      } catch (error) {
        const message = error?.errMsg || error?.message || "";
        if (/not in domain list|合法域名|url check/i.test(message)) {
          return { status: "blocked", message: "开发者工具已拦截本地地址，请仅在本地调试时关闭合法域名校验" };
        }
        return { status: "offline", message: "本地结果服务不可用，请运行 frontend-demo 的 npm start 后重试" };
      }
    },

    async getRegistry() {
      if (mode === "local") return nativeRuntime.registry;
      return (await callCloud("get-bank", { action: "versions" })).data;
    },

    async getBank(version, clientBankVersion = "") {
      if (mode === "cloud") {
        return (await callCloud("get-bank", { version, client_bank_version: clientBankVersion })).data;
      }
      const versionConfig = findVersion(nativeRuntime.registry, version);
      const bank = nativeRuntime.banks[versionConfig.id];
      if (!bank) throw new Error("该测试版本暂不可用");
      if (clientBankVersion && clientBankVersion !== bank.bank_version) {
        throw new Error("题库已更新，请刷新后重新提交");
      }
      return bank;
    },

    async submitQuiz(data) {
      if (mode === "local") return localRequest(data);
      return callCloud("submit-quiz", data);
    },

    async recordShare(data) {
      if (mode === "local") {
        return { code: 0, message: "local demo", data: { share_record_id: "local-demo-share" } };
      }
      return callCloud("record-share", data);
    }
  };
}

module.exports = { createQuizService, healthEndpoint };
