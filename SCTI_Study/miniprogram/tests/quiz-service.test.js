const test = require("node:test");
const assert = require("node:assert/strict");

const nativeRuntime = require("../data/runtime");
const { createQuizService, healthEndpoint } = require("../services/quiz-service");

const localConfig = {
  cloudEnvId: "",
  localResultEndpoint: "http://127.0.0.1:4175/api/submit-quiz",
  requestTimeoutMs: 12000
};

function payload(version = "high_school") {
  const bank = nativeRuntime.banks[version];
  return {
    version,
    bank_version: bank.bank_version,
    answers: bank.questions.map((question) => ({ qid: question.id, selected: 0 }))
  };
}

function successResponse(version = "high_school") {
  return {
    code: 0,
    message: "success",
    data: { record_id: "local-record", server_result: { version } }
  };
}

test("health classifies DevTools domain blocking separately", async () => {
  const service = createQuizService({
    wxApi: { request({ fail }) { fail({ errMsg: "request:fail url not in domain list" }); } },
    runtimeConfig: localConfig,
    nativeRuntime
  });

  assert.deepEqual(await service.checkHealth(), {
    status: "blocked",
    message: "开发者工具已拦截本地地址，请仅在本地调试时关闭合法域名校验"
  });
});

test("health reports an offline computer service", async () => {
  const service = createQuizService({
    wxApi: { request({ fail }) { fail({ errMsg: "request:fail connect ECONNREFUSED" }); } },
    runtimeConfig: localConfig,
    nativeRuntime
  });

  assert.equal((await service.checkHealth()).status, "offline");
});

test("health endpoint is derived from the configured submit endpoint", () => {
  assert.equal(
    healthEndpoint("http://127.0.0.1:4175/api/submit-quiz"),
    "http://127.0.0.1:4175/api/health"
  );
});

test("local health requests the configured endpoint with its timeout", async () => {
  const calls = [];
  const service = createQuizService({
    wxApi: {
      request(options) {
        calls.push(options);
        options.success({ statusCode: 200, data: { code: 0, data: { mode: "local" } } });
      }
    },
    runtimeConfig: localConfig,
    nativeRuntime
  });

  assert.deepEqual(await service.checkHealth(), { status: "connected", message: "本地结果服务已连接" });
  assert.equal(calls[0].url, "http://127.0.0.1:4175/api/health");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].timeout, localConfig.requestTimeoutMs);
});

test("cloud health stays in CloudBase mode", async () => {
  let localCalls = 0;
  const service = createQuizService({
    wxApi: { request({ fail }) { localCalls += 1; fail({ errMsg: "request:fail connect ECONNREFUSED" }); } },
    runtimeConfig: { ...localConfig, cloudEnvId: " " },
    nativeRuntime
  });

  assert.deepEqual(await service.checkHealth(), { status: "cloud", message: "云端结果服务" });
  assert.equal(localCalls, 0);
});

test("local mode reads bundled banks and posts only to the local result endpoint", async () => {
  const calls = [];
  const service = createQuizService({
    wxApi: {
      request(options) {
        calls.push(options);
        options.success({ statusCode: 200, data: successResponse() });
      }
    },
    runtimeConfig: {
      cloudEnvId: "",
      localResultEndpoint: "http://127.0.0.1:4175/api/submit-quiz",
      requestTimeoutMs: 12000
    },
    nativeRuntime
  });

  assert.equal((await service.getRegistry()).versions.length, 3);
  assert.equal((await service.getBank("high_school", "5.0.0")).version, "high_school");
  assert.equal((await service.submitQuiz(payload())).code, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:4175/api/submit-quiz");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].data, payload());
});

test("local mode rejects missing versions, stale banks, and unavailable service", async () => {
  const service = createQuizService({
    wxApi: { request(options) { options.fail({ errMsg: "request:fail" }); } },
    runtimeConfig: { cloudEnvId: "", localResultEndpoint: "http://127.0.0.1:4175/api/submit-quiz", requestTimeoutMs: 1 },
    nativeRuntime
  });

  await assert.rejects(() => service.getBank("", ""), /该测试版本暂不可用/);
  await assert.rejects(() => service.getBank("university", "4.9.0"), /题库已更新/);
  await assert.rejects(() => service.submitQuiz(payload()), /本地结果服务不可用，请运行 frontend-demo 的 npm start/);
});

test("cloud mode uses cloud functions and never falls back to localhost", async () => {
  const cloudCalls = [];
  let localCalls = 0;
  const service = createQuizService({
    wxApi: {
      request() { localCalls += 1; },
      cloud: {
        callFunction(args) {
          cloudCalls.push(args);
          if (args.name === "get-bank" && args.data.action === "versions") {
            return Promise.resolve({ result: { code: 0, data: nativeRuntime.registry } });
          }
          if (args.name === "get-bank") {
            return Promise.resolve({ result: { code: 0, data: nativeRuntime.banks[args.data.version] } });
          }
          if (args.name === "submit-quiz") return Promise.resolve({ result: successResponse("graduate") });
          return Promise.resolve({ result: { code: 0, data: { share_record_id: "share-id" } } });
        }
      }
    },
    runtimeConfig: { cloudEnvId: "env-test", localResultEndpoint: "http://127.0.0.1:4175/api/submit-quiz", requestTimeoutMs: 12000 },
    nativeRuntime
  });

  assert.equal((await service.getRegistry()).default_version, "university");
  assert.equal((await service.getBank("graduate", "5.0.0")).version, "graduate");
  assert.equal((await service.submitQuiz(payload("graduate"))).code, 0);
  assert.equal((await service.recordShare({ record_id: "r1" })).code, 0);
  assert.deepEqual(cloudCalls.map(({ name }) => name), ["get-bank", "get-bank", "submit-quiz", "record-share"]);
  assert.equal(localCalls, 0);
});

test("cloud failures remain cloud failures", async () => {
  let localCalls = 0;
  const service = createQuizService({
    wxApi: {
      request() { localCalls += 1; },
      cloud: { callFunction() { return Promise.reject(new Error("offline")); } }
    },
    runtimeConfig: { cloudEnvId: "env-test", localResultEndpoint: "http://127.0.0.1:4175/api/submit-quiz" },
    nativeRuntime
  });

  await assert.rejects(() => service.submitQuiz(payload()), /云端服务暂不可用，请稍后重试/);
  assert.equal(localCalls, 0);
});

test("local sharing is a no-op success", async () => {
  const service = createQuizService({
    wxApi: {},
    runtimeConfig: { cloudEnvId: "" },
    nativeRuntime
  });
  assert.deepEqual(await service.recordShare({ record_id: "r1" }), {
    code: 0,
    message: "local demo",
    data: { share_record_id: "local-demo-share" }
  });
});
