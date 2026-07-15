const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtime = require("../data/runtime");
const { createSelectionFlow } = require("../utils/selection-flow");
const {
  acceptLoadedBank,
  acceptResult,
  beginVersion,
  createPageState,
  currentOperation
} = require("../pages/index/controller");

let pageDefinition;
const previousPage = global.Page;
global.Page = (definition) => {
  pageDefinition = definition;
};
require("../pages/index/index");
if (previousPage === undefined) delete global.Page;
else global.Page = previousPage;

function loadedState(version) {
  let state = beginVersion(createPageState(runtime.registry), version);
  return acceptLoadedBank(state, runtime.banks[version], currentOperation(state));
}

function createPage(state, snapshot, t) {
  const previousWx = global.wx;
  global.wx = {
    getStorageSync() {
      return snapshot;
    },
    pageScrollTo() {},
    setStorageSync() {},
    showToast() {}
  };
  t.after(() => {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  });
  return {
    ...pageDefinition,
    runtimeState: state,
    data: { ...pageDefinition.data },
    setData(update) {
      Object.assign(this.data, update);
    }
  };
}

function progressSnapshot(state, questionIndex, answers) {
  return {
    version: state.bank.version,
    bankVersion: state.bank.bank_version,
    questionIndex,
    answers
  };
}

function publicResult(version) {
  return {
    version,
    bank_version: "5.0.0",
    algorithm_version: "three-layer.v2.0.0",
    tag_id: "U1",
    tag_name: "测试人设",
    tag_short_desc: "一段有效的简短人设说明",
    tag_full_desc: {
      paragraph_1: "第一段完整结果说明文字。",
      paragraph_2: "第二段完整结果说明文字。",
      paragraph_3: "第三段完整结果说明文字。"
    },
    keywords: ["#测试人设", "#校园"],
    share_copy: "我测出是测试人设，来看看你的校园人设。",
    match_method: "score",
    dimensions: {
      labels: ["投入度", "社交度", "执行力", "开放性"],
      user_vector: [4, 3, 4, 3],
      manhattan_distance: 2
    },
    easter_eggs: [],
    self_perception: { qid: 20, option_id: "A", text: "自我认知" }
  };
}

function resultState(version = "university") {
  const state = loadedState(version);
  return acceptResult(state, publicResult(version), currentOperation(state));
}

test("restoreProgress enters review mode for an answered Q1", (t) => {
  const state = loadedState("university");
  const page = createPage(state, progressSnapshot(state, 0, { 1: 0 }), t);

  page.restoreProgress();

  assert.equal(page.runtimeState.questionIndex, 0);
  assert.equal(page.runtimeState.navigationMode, "review");
});

test("restoreProgress enters review mode for an answered Q20", (t) => {
  const state = loadedState("graduate");
  const page = createPage(state, progressSnapshot(state, 19, { 20: 7 }), t);

  page.restoreProgress();

  assert.equal(page.runtimeState.questionIndex, 19);
  assert.equal(page.runtimeState.navigationMode, "review");
});

test("restoreProgress keeps auto mode for an unanswered current question", (t) => {
  const state = loadedState("high_school");
  const page = createPage(state, progressSnapshot(state, 1, { 1: 0 }), t);

  page.restoreProgress();

  assert.equal(page.runtimeState.questionIndex, 1);
  assert.equal(page.runtimeState.navigationMode, "auto");
});

test("a cancelled selection callback cannot advance after page navigation", (t) => {
  const state = { ...loadedState("university"), questionIndex: 1 };
  const page = createPage(state, null, t);
  const scheduled = [];
  let scrolled = 0;
  page.selectionFlow = createSelectionFlow({
    setTimer(callback) {
      scheduled.push(callback);
      return scheduled.length;
    },
    clearTimer() {}
  });
  page.saveProgress = () => {};
  page.syncView = () => {};
  page.scrollQuestionTop = () => {
    scrolled += 1;
  };

  page.selectOption({ currentTarget: { dataset: { index: 0 } } });
  page.showIdentity();
  scheduled[0]();

  assert.equal(page.runtimeState.screen, "identity");
  assert.equal(page.runtimeState.questionIndex, 1);
  assert.equal(scrolled, 0);
});

test("local health is checked on load and can be retried", async (t) => {
  const page = createPage(createPageState(runtime.registry), null, t);
  let requests = 0;
  global.wx.request = ({ success }) => {
    requests += 1;
    success({ statusCode: 200, data: { code: 0, data: { mode: "local" } } });
  };

  page.onLoad();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.data.serviceStatus, "connected");

  page.retryServiceHealth();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests, 2);
});

test("stale local health completion after navigation leaves a retryable status", async (t) => {
  const page = createPage(createPageState(runtime.registry), null, t);
  let completeHealth;
  let requests = 0;
  global.wx.request = ({ success }) => {
    requests += 1;
    completeHealth = () => success({ statusCode: 200, data: { code: 0, data: { mode: "local" } } });
  };

  page.onLoad();
  page.showIdentity();
  completeHealth();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(page.data.serviceStatus, "offline");
  assert.match(page.data.serviceMessage, /重新检查/);

  global.wx.request = ({ success }) => {
    requests += 1;
    success({ statusCode: 200, data: { code: 0, data: { mode: "local" } } });
  };
  page.retryServiceHealth();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests, 2);
  assert.equal(page.data.serviceStatus, "connected");
});

test("onShareAppMessage returns only supported share content fields", (t) => {
  const page = createPage(resultState(), null, t);
  page.quizService = { recordShare: () => Promise.resolve({ code: 0 }) };
  page.syncView();

  const payload = page.onShareAppMessage();

  assert.deepEqual(Object.keys(payload).sort(), ["path", "title"]);
  assert.equal(payload.title, "我测出是测试人设，来看看你的校园人设。");
  assert.equal(payload.path, "/pages/index/index");
});

test("explicit share preview opens only from the current result", (t) => {
  const page = createPage(resultState(), null, t);
  page.syncView();
  const wxml = fs.readFileSync(path.resolve(__dirname, "../pages/index/index.wxml"), "utf8");

  assert.match(wxml, /bindtap="openShareFallback"/);
  assert.ok(page.openShareFallback());
  assert.equal(page.data.shareFallbackVisible, true);

  page.backToQuiz();

  assert.equal(page.openShareFallback(), null);
  assert.equal(page.data.shareFallbackVisible, false);
});

test("delayed recordShare failure after leaving result cannot reopen share fallback", async (t) => {
  const page = createPage(resultState(), null, t);
  let rejectRecordShare;
  page.quizService = {
    recordShare() {
      return new Promise((resolve, reject) => {
        rejectRecordShare = reject;
      });
    }
  };
  page.syncView();

  page.onShareAppMessage();
  page.backToQuiz();
  rejectRecordShare(new Error("record share failed"));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(page.runtimeState.screen, "quiz");
  assert.equal(page.data.shareFallbackVisible, false);
});

test("native result page has a configurable art stage and aligned answer width", () => {
  const wxml = fs.readFileSync(path.resolve(__dirname, "../pages/index/index.wxml"), "utf8");
  const wxss = fs.readFileSync(path.resolve(__dirname, "../pages/index/index.wxss"), "utf8");
  assert.match(wxml, /class="result-art-stage"/);
  assert.match(wxml, /background:\{\{character\.hero_background\}\}/);
  assert.match(wxml, /binderror="handleCharacterError"/);
  assert.match(wxss, /\.question-card,\s*\.option-list/);
  assert.match(wxss, /\.option-list\s*\{[^}]*align-self:\s*stretch/s);
  assert.match(wxss, /\.option-button\s*\{[^}]*width:\s*100%/s);
  assert.match(wxss, /\.option-button\s*\{[^}]*align-self:\s*stretch/s);
  assert.match(wxml, /<view[^>]*class="option-button/);
  assert.doesNotMatch(wxml, /<button[^>]*class="option-button/);
  assert.match(wxss, /\.option-text\s*\{[^}]*text-align:\s*left/s);
  assert.doesNotMatch(wxss, /\.option-button\.is-selected\s*\{[^}]*transform:/s);
  assert.doesNotMatch(wxss, /\.option-list\s*\{[^}]*margin-(?:left|right):/s);
});

test("welcome content scrolls on shorter device viewports", () => {
  const wxml = fs.readFileSync(path.resolve(__dirname, "../pages/index/index.wxml"), "utf8");
  const wxss = fs.readFileSync(path.resolve(__dirname, "../pages/index/index.wxss"), "utf8");
  assert.match(wxml, /<scroll-view\s+wx:if="\{\{screen === 'welcome'\}\}"[^>]*class="screen page welcome-screen"[^>]*scroll-y/);
  assert.match(wxss, /\.welcome-screen\s*\{[^}]*justify-content:\s*flex-start/s);
  assert.match(wxss, /\.welcome-screen\s*\{[^}]*height:\s*100vh/s);
  assert.match(wxss, /\.welcome-screen\s*\{[^}]*min-height:\s*0/s);
  assert.match(wxss, /\.welcome-actions\s*\{[^}]*flex-shrink:\s*0/s);
});
