const runtimeConfig = require("./config/runtime");

App({
  onLaunch() {
    if (runtimeConfig.cloudEnvId && wx.cloud) {
      wx.cloud.init({ env: runtimeConfig.cloudEnvId, traceUser: true });
    }
  }
});
