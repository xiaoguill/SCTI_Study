import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const miniRoot = path.join(root, "miniprogram");

function requireFile(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`missing mini program file: ${relativePath}`);
  return file;
}

const appJsonFile = requireFile("miniprogram/app.json");
requireFile("miniprogram/app.js");
requireFile("miniprogram/app.wxss");
requireFile("miniprogram/sitemap.json");
const appJson = JSON.parse(fs.readFileSync(appJsonFile, "utf8"));
if (!Array.isArray(appJson.pages) || appJson.pages.length === 0) throw new Error("app.json must declare at least one page");

for (const page of appJson.pages) {
  if (!/^[a-z0-9_/-]+$/i.test(page) || page.includes("..")) throw new Error(`invalid page path: ${page}`);
  for (const extension of ["js", "json", "wxml", "wxss"]) {
    requireFile(path.join("miniprogram", `${page}.${extension}`));
  }
}

const indexWxmlFile = requireFile("miniprogram/pages/index/index.wxml");
const indexJsFile = requireFile("miniprogram/pages/index/index.js");
const indexWxssFile = requireFile("miniprogram/pages/index/index.wxss");
const wxml = fs.readFileSync(indexWxmlFile, "utf8");
const wxss = fs.readFileSync(indexWxssFile, "utf8");
const nativePageSource = `${wxml}\n${fs.readFileSync(indexJsFile, "utf8")}`;
const requiredClasses = [
  "welcome-top", "welcome-copy", "campus-art", "hero-card",
  "identity-list", "quiz-topline", "question-card", "option-list",
  "analysis-steps", "result-hero", "result-card", "service-chip"
];
for (const className of requiredClasses) {
  if (!wxml.includes(className)) throw new Error(`native page missing parity class: ${className}`);
}
for (const desktopOnlyClass of ["prototype-intro", "phone-device", "phone-speaker", "status-bar", "home-indicator"]) {
  if (nativePageSource.includes(desktopOnlyClass)) {
    throw new Error(`native page includes desktop-only prototype class: ${desktopOnlyClass}`);
  }
}
if (/\bQ(?:[1-9]|1\d|20)\b/.test(nativePageSource)) {
  throw new Error("native page hard-codes a canonical question ID");
}
if (!/\.result-actions\s+button\s*\+\s*button\s*\{[^}]*margin-top:\s*19\.23rpx\s*;?[^}]*\}/s.test(wxss)) {
  throw new Error("adjacent result actions must keep the approved 19.23rpx gap");
}

const runtimeFile = requireFile("miniprogram/data/runtime.js");
const runtimeSource = fs.readFileSync(runtimeFile, "utf8");
for (const privateField of ["scores_ranking", "target_vector", "core_questions", "algorithm_profile", "\"scores\""]) {
  if (runtimeSource.includes(privateField)) throw new Error(`native runtime exposes private field: ${privateField}`);
}
for (const version of ["high_school", "university", "graduate"]) {
  if (!runtimeSource.includes(`\"${version}\"`)) throw new Error(`native runtime missing version: ${version}`);
}

if (!path.resolve(appJsonFile).startsWith(`${miniRoot}${path.sep}`)) throw new Error("app.json must stay under miniprogram root");
console.log(`PASS native mini program: ${appJson.pages.length} page, 3 quiz versions`);
