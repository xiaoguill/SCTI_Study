const test = require("node:test");
const assert = require("node:assert/strict");

const { getPublicBank } = require("../cloudfunctions/get-bank/bank-store");
const { getRuntime } = require("../cloudfunctions/submit-quiz/bank-store");

test("get-bank resolves every enabled public bank", () => {
  for (const version of ["high_school", "university", "graduate"]) {
    const response = getPublicBank(version, "");
    assert.equal(response.version, version);
    assert.equal(response.need_update, true);
  }
});

test("get-bank rejects unknown and disabled versions", () => {
  assert.throws(() => getPublicBank("unknown", "5.0.0"), (error) => error.code === 404);
  const registry = require("../cloudfunctions/get-bank/data/runtime-registry.json");
  registry.versions.push({ id: "disabled", enabled: false });
  try {
    assert.throws(() => getPublicBank("disabled", "5.0.0"), (error) => error.code === 404);
  } finally {
    registry.versions.pop();
  }
});

test("submit runtime rejects unknown and mismatched versions", () => {
  assert.throws(() => getRuntime("unknown", "5.0.0"), (error) => error.code === 404);
  assert.throws(() => getRuntime("university", "4.9.0"), (error) => error.code === 409);
  assert.equal(getRuntime("graduate", "5.0.0").bank.version, "graduate");
});

test("submit runtime rejects disabled versions", () => {
  const registry = require("../cloudfunctions/submit-quiz/data/runtime-registry.json");
  registry.versions.push({ id: "disabled", enabled: false });
  try {
    assert.throws(() => getRuntime("disabled", "5.0.0"), (error) => error.code === 404);
  } finally {
    registry.versions.pop();
  }
});
