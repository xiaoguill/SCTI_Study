function runtimeMode(config = module.exports) {
  return config?.cloudEnvId === "" ? "local" : "cloud";
}

module.exports = {
  cloudEnvId: "",
  localResultEndpoint: "http://127.0.0.1:4175/api/submit-quiz",
  requestTimeoutMs: 12000,
  runtimeMode
};
