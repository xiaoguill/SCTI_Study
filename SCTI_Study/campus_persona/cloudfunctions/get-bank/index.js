const cloud = require("wx-server-sdk");
const publicBank = require("./university-bank.public.json");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event = {}) => {
  if (event.version && event.version !== "university") {
    return { code: 404, message: "仅支持大学版 MVP", data: null };
  }
  return {
    code: 0,
    message: "success",
    data: {
      ...publicBank,
      need_update: event.client_bank_version !== publicBank.bank_version
    }
  };
};
