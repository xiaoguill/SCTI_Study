import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  applyTheme,
  enabledVersions,
  findVersion,
  progressKey
} from "../version-context.mjs";

const require = createRequire(import.meta.url);
const registry = require("../data/runtime-registry.json");

test("enabled versions follow registry order", () => {
  const versions = enabledVersions(registry);

  assert.deepEqual(versions.map((item) => item.id), ["high_school", "university", "graduate"]);
});

test("findVersion returns an enabled version and rejects disabled or missing versions", () => {
  assert.equal(findVersion(registry, "university").id, "university");
  assert.throws(() => findVersion({ versions: [{ id: "paused", enabled: false, order: 1 }] }, "paused"));
  assert.throws(() => findVersion(registry, "unknown"));
});

test("progress keys isolate version and bank version", () => {
  const highSchool = findVersion(registry, "high_school");
  const graduate = findVersion(registry, "graduate");

  assert.equal(progressKey(highSchool), "campus-persona-high-school:5.0.0:progress");
  assert.notEqual(progressKey(highSchool), progressKey(graduate));
});

test("applyTheme sets all version theme variables", () => {
  const values = new Map();
  const root = { style: { setProperty: (name, value) => values.set(name, value) } };

  applyTheme(root, findVersion(registry, "graduate"));

  assert.deepEqual(Object.fromEntries(values), {
    "--version-accent": "#cdb6f6",
    "--version-accent-light": "#eee5ff",
    "--version-card": "#fff0a8"
  });
});

test("getBank requires an explicit version before calling any transport", async () => {
  const originalWx = globalThis.wx;
  const originalFetch = globalThis.fetch;
  let cloudCalls = 0;
  let fetchCalls = 0;
  globalThis.wx = { cloud: { callFunction: async () => {
    cloudCalls += 1;
    return { result: { code: 0, data: { version: "university", bank_version: "5.0.0" } } };
  } } };
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return { ok: true, json: async () => registry };
  };
  try {
    const cloud = await import(`../api/cloud.js?required-version=${Date.now()}`);
    await assert.rejects(() => cloud.getBank(), /必须指定测试版本/);
    assert.equal(cloudCalls, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.wx = originalWx;
    globalThis.fetch = originalFetch;
  }
});

test("local API caches registry and banks by version and bank version", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  const banks = {
    high_school: { version: "high_school", bank_version: "5.0.0", questions: [] },
    university: { version: "university", bank_version: "5.0.0", questions: [] }
  };
  globalThis.fetch = async (url) => {
    requestedUrls.push(url);
    if (url === "./data/runtime-registry.json") return { ok: true, json: async () => registry };
    if (url === "./data/high_school.v5.0.0.public.json") return { ok: true, json: async () => banks.high_school };
    if (url === "./data/university.v5.0.0.public.json") return { ok: true, json: async () => banks.university };
    throw new Error(`Unexpected URL: ${url}`);
  };
  try {
    const cloud = await import(`../api/cloud.js?cache-test=${Date.now()}`);
    assert.equal(await cloud.getVersionRegistry(), registry);
    assert.equal(await cloud.getVersionRegistry(), registry);
    assert.equal(await cloud.getBank("high_school", "5.0.0"), banks.high_school);
    assert.equal(await cloud.getBank("high_school", "5.0.0"), banks.high_school);
    assert.equal(await cloud.getBank("university", "5.0.0"), banks.university);
    assert.deepEqual(requestedUrls, [
      "./data/runtime-registry.json",
      "./data/high_school.v5.0.0.public.json",
      "./data/university.v5.0.0.public.json"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("WeChat API requests versions and caches banks by version and bank version", async () => {
  const originalWx = globalThis.wx;
  const calls = [];
  const banks = {
    high_school: { version: "high_school", bank_version: "5.0.0", questions: [] },
    university: { version: "university", bank_version: "5.0.0", questions: [] }
  };
  globalThis.wx = {
    cloud: {
      callFunction: async ({ name, data }) => {
        calls.push({ name, data });
        return {
          result: data.action === "versions"
            ? { code: 0, data: registry }
            : { code: 0, data: banks[data.version] }
        };
      }
    }
  };
  try {
    const cloud = await import(`../api/cloud.js?wechat-cache-test=${Date.now()}`);
    await cloud.getVersionRegistry();
    await cloud.getVersionRegistry();
    await cloud.getBank("high_school", "5.0.0");
    await cloud.getBank("high_school", "5.0.0");
    await cloud.getBank("university", "5.0.0");
    assert.deepEqual(calls, [
      { name: "get-bank", data: { action: "versions" } },
      { name: "get-bank", data: { version: "high_school", client_bank_version: "5.0.0" } },
      { name: "get-bank", data: { version: "university", client_bank_version: "5.0.0" } }
    ]);
  } finally {
    globalThis.wx = originalWx;
  }
});
