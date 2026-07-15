const cloud = require("wx-server-sdk");
const { getPublicBank, publicRegistry } = require("./bank-store");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event = {}) => {
  try {
    if (event.action === "versions") {
      return { code: 0, message: "success", data: publicRegistry };
    }
    return {
      code: 0,
      message: "success",
      data: getPublicBank(event.version, event.client_bank_version || "")
    };
  } catch (error) {
    return { code: error.code || 500, message: error.message || "题库服务暂不可用", data: null };
  }
};
