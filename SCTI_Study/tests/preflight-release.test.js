const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

test("release preflight proves the repository-ready client boundary", async () => {
  const { auditRelease } = await import("../scripts/preflight-release.mjs");
  const report = await auditRelease(path.resolve(__dirname, ".."));

  assert.deepEqual(report.errors, []);
  assert.equal(report.metrics.enabledVersions, 3);
  assert.equal(report.metrics.presentationTags, 48);
  assert.equal(report.metrics.cloudFunctions, 4);
  assert.ok(report.metrics.generatedArtifacts > 0);
  assert.equal(report.metrics.staleGeneratedArtifacts, 0);
  assert.ok(report.metrics.packageBytes < 2 * 1024 * 1024);
  assert.match(report.warnings.join("\n"), /CloudBase 环境 ID/);
  assert.match(report.warnings.join("\n"), /47 个标签/);
});

test("release mode blocks local-only and unversioned project state", async () => {
  const { auditRelease } = await import("../scripts/preflight-release.mjs");
  const report = await auditRelease(path.resolve(__dirname, ".."), { release: true });

  assert.match(report.errors.join("\n"), /CloudBase 环境 ID/);
  assert.match(report.errors.join("\n"), /Git/);
});

test("private scoring field scan rejects every protected client key", async () => {
  const { findPrivateFields } = await import("../scripts/preflight-release.mjs");
  assert.deepEqual(
    findPrivateFields('{"target_vector":[],"scores_ranking":{},"core_questions":[],"algorithm_profile":"x","scores":{},"weights":{}}'),
    ["target_vector", "scores_ranking", "core_questions", "algorithm_profile", "scores", "weights"]
  );
  assert.deepEqual(findPrivateFields('{"questions":[],"dimensions":{"user_vector":[]}}'), []);
});
