import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_FUNCTIONS = ["get-bank", "submit-quiz", "user-login", "record-share"];
const MAX_MAIN_PACKAGE_BYTES = 2 * 1024 * 1024;

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function inspectGit(projectRoot) {
  try {
    const run = (...args) => execFileSync("git", args, { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const root = run("rev-parse", "--show-toplevel");
    const branch = run("branch", "--show-current");
    const remote = run("remote", "get-url", "origin");
    const dirty = run("status", "--porcelain");
    return { ready: Boolean(root && branch && remote && !dirty), branch, remote, dirty: Boolean(dirty) };
  } catch {
    return { ready: false, branch: "", remote: "", dirty: false };
  }
}

export function findPrivateFields(sourceText) {
  const privatePatterns = [
    ["target_vector", /["']target_vector["']\s*:/],
    ["scores_ranking", /["']scores_ranking["']\s*:/],
    ["core_questions", /["']core_questions["']\s*:/],
    ["algorithm_profile", /["']algorithm_profile["']\s*:/],
    ["scores", /["']scores["']\s*:/],
    ["weights", /["']weights["']\s*:/]
  ];
  return privatePatterns.filter(([, pattern]) => pattern.test(sourceText)).map(([field]) => field);
}

export async function auditRelease(projectRoot, { release = false } = {}) {
  const errors = [];
  const warnings = [];
  const miniprogramRoot = path.join(projectRoot, "miniprogram");
  const projectConfigPath = path.join(projectRoot, "project.config.json");
  const privateConfigPath = path.join(projectRoot, "project.private.config.json");
  const runtimeDataPath = path.join(miniprogramRoot, "data", "runtime.js");
  const runtimeConfigPath = path.join(miniprogramRoot, "config", "runtime.js");

  for (const requiredPath of [
    projectConfigPath,
    path.join(miniprogramRoot, "app.json"),
    runtimeDataPath,
    runtimeConfigPath
  ]) {
    if (!fs.existsSync(requiredPath)) errors.push(`缺少发布文件：${path.relative(projectRoot, requiredPath)}`);
  }

  if (errors.length) {
    return { errors, warnings, metrics: { enabledVersions: 0, presentationTags: 0, cloudFunctions: 0, generatedArtifacts: 0, staleGeneratedArtifacts: 0, packageBytes: 0 } };
  }

  const git = inspectGit(projectRoot);
  if (!git.ready) {
    const message = "Git 发布基线未就绪：必须存在干净工作树、当前分支和 origin 远端。";
    (release ? errors : warnings).push(message);
  }

  const projectConfig = readJson(projectConfigPath);
  const appConfig = readJson(path.join(miniprogramRoot, "app.json"));
  if (projectConfig.miniprogramRoot !== "miniprogram/") errors.push("project.config.json 未指向 miniprogram/");
  if (!projectConfig.appid || projectConfig.appid === "touristappid") errors.push("project.config.json 缺少可用 AppID");
  if (projectConfig.setting?.ignoreUploadUnusedFiles !== true) {
    const message = "project.config.json 应启用 ignoreUploadUnusedFiles，避免测试文件进入上传包。";
    (release ? errors : warnings).push(message);
  }
  if (!Array.isArray(appConfig.pages) || !appConfig.pages.includes("pages/index/index")) errors.push("app.json 缺少原生首页");

  const require = createRequire(import.meta.url);
  const runtimeData = require(runtimeDataPath);
  const runtimeConfig = require(runtimeConfigPath);
  const versions = runtimeData.registry?.versions?.filter((item) => item.enabled) || [];
  const presentationTags = Object.keys(runtimeData.presentation?.tags || {});
  const configuredImageEntries = Object.values(runtimeData.presentation?.tags || {})
    .map((item) => item.character_image)
    .filter(Boolean);
  const configuredImages = new Set(configuredImageEntries);
  for (const imagePath of configuredImages) {
    const diskPath = path.join(miniprogramRoot, imagePath.replace(/^\//, ""));
    if (!fs.existsSync(diskPath)) errors.push(`人物资源不存在：${imagePath}`);
  }
  const missingImageCount = presentationTags.length - configuredImageEntries.length;
  if (missingImageCount > 0) warnings.push(`${missingImageCount} 个标签仍使用统一占位人物；不阻断功能发布，但上线前宜继续补图。`);

  if (!runtimeConfig.cloudEnvId) {
    const message = "CloudBase 环境 ID 为空：正式发布不能依赖开发者电脑的本地服务。";
    (release ? errors : warnings).push(message);
  }
  if (fs.existsSync(privateConfigPath)) {
    const privateConfig = readJson(privateConfigPath);
    if (privateConfig.setting?.urlCheck === false) warnings.push("project.private.config.json 的 urlCheck=false 仅用于本地调试，真机与发布必须走 CloudBase。");
  }

  const cloudRoot = path.join(projectRoot, "campus_persona", "cloudfunctions");
  const cloudFunctions = REQUIRED_FUNCTIONS.filter((name) => {
    const functionRoot = path.join(cloudRoot, name);
    return fs.existsSync(path.join(functionRoot, "index.js")) && fs.existsSync(path.join(functionRoot, "package.json"));
  });
  for (const name of REQUIRED_FUNCTIONS) {
    if (!cloudFunctions.includes(name)) errors.push(`云函数仓库文件不完整：${name}`);
  }

  const buildModuleUrl = pathToFileURL(
    path.join(projectRoot, "campus_persona", "scripts", "build-question-banks.mjs")
  ).href;
  const { buildQuestionBanks } = await import(buildModuleUrl);
  const generatedArtifacts = buildQuestionBanks({ write: false });
  const staleGeneratedArtifacts = generatedArtifacts.filter(({ target, value }) => {
    if (!fs.existsSync(target)) return true;
    const expected = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
    return fs.readFileSync(target, "utf8") !== expected;
  });
  for (const { target } of staleGeneratedArtifacts) {
    errors.push(`生成文件已过期：${path.relative(projectRoot, target)}`);
  }

  const packageBytes = walkFiles(miniprogramRoot).reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
  if (packageBytes >= MAX_MAIN_PACKAGE_BYTES) errors.push(`小程序主包达到 ${packageBytes} 字节，超过 2 MB 发布边界`);

  const uploadScopeFiles = walkFiles(miniprogramRoot)
    .filter((filePath) => !filePath.startsWith(path.join(miniprogramRoot, "tests") + path.sep))
    .filter((filePath) => /\.(?:js|json|wxml|wxss)$/.test(filePath));
  const sourceText = uploadScopeFiles
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");
  for (const field of findPrivateFields(sourceText)) {
    errors.push(`客户端上传范围包含私有评分字段：${field}`);
  }
  if (/\b(?:APPSECRET|OPENID_HMAC_SECRET)\s*[:=]\s*["'][^"']+["']/i.test(sourceText)) {
    errors.push("客户端疑似包含真实密钥配置");
  }

  return {
    errors,
    warnings,
    metrics: {
      enabledVersions: versions.length,
      presentationTags: presentationTags.length,
      configuredImages: configuredImages.size,
      configuredImageTags: configuredImageEntries.length,
      cloudFunctions: cloudFunctions.length,
      generatedArtifacts: generatedArtifacts.length,
      staleGeneratedArtifacts: staleGeneratedArtifacts.length,
      gitReady: git.ready,
      packageBytes
    }
  };
}

async function main() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const release = process.argv.includes("--release");
  const report = await auditRelease(projectRoot, { release });
  console.log(`${report.errors.length ? "FAIL" : "PASS"} mode=${release ? "release" : "local"} versions=${report.metrics.enabledVersions} tags=${report.metrics.presentationTags} images=${report.metrics.configuredImageTags || 0} cloudFunctions=${report.metrics.cloudFunctions} packageBytes=${report.metrics.packageBytes}`);
  report.warnings.forEach((message) => console.warn(`WARN ${message}`));
  report.errors.forEach((message) => console.error(`ERROR ${message}`));
  if (report.errors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
