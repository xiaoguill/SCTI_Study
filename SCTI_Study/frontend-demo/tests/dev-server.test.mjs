import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createDemoServer } from "../dev-server.mjs";

const require = createRequire(import.meta.url);
const bank = require("../../campus_persona/data/banks/high_school.v5.0.0.json");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("local server exposes a health boundary", async () => {
  const server = createDemoServer();
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { code: 0, data: { mode: "local" } });
  } finally {
    await close(server);
  }
});

test("local result endpoint accepts native requests and returns only public result fields", async () => {
  const server = createDemoServer();
  const port = await listen(server);
  try {
    const optionsResponse = await fetch(`http://127.0.0.1:${port}/api/submit-quiz`, { method: "OPTIONS" });
    assert.equal(optionsResponse.status, 204);

    const response = await fetch(`http://127.0.0.1:${port}/api/submit-quiz`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: bank.version,
        bank_version: bank.bank_version,
        answers: bank.questions.map((question) => ({ qid: question.id, selected: 0 }))
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.code, 0);
    assert.equal(body.data.server_result.version, "high_school");
    assert.equal("scores_ranking" in body.data.server_result, false);
    assert.equal("target_vector" in body.data.server_result.dimensions, false);
  } finally {
    await close(server);
  }
});
