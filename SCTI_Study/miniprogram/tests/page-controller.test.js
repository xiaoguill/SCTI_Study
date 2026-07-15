const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("validator excludes the full desktop prototype shell", () => {
  const validator = fs.readFileSync(path.resolve(__dirname, "../../scripts/validate-mini-program.mjs"), "utf8");

  for (const className of ["prototype-intro", "phone-device", "phone-speaker", "status-bar", "home-indicator"]) {
    assert.match(validator, new RegExp(`"${className}"`));
  }
});

const runtime = require("../data/runtime");
const {
  acceptLoadedBank,
  acceptResult,
  beginVersion,
  createPageState,
  currentOperation,
  nextQuestionState,
  previousQuestionState,
  questionModel,
  recoverLoadError,
  recoverSubmitError,
  selectionNavigation,
  selectAnswer
} = require("../pages/index/controller");

let pageDefinition;
const previousPage = global.Page;
global.Page = (definition) => {
  pageDefinition = definition;
};
require("../pages/index/index");
if (previousPage === undefined) delete global.Page;
else global.Page = previousPage;

function pageView(state) {
  return {
    ...pageDefinition,
    runtimeState: state,
    data: { ...pageDefinition.data },
    setData(update) {
      Object.assign(this.data, update);
    }
  };
}

function loadedState(version) {
  let state = beginVersion(createPageState(runtime.registry), version);
  return acceptLoadedBank(state, runtime.banks[version], currentOperation(state));
}

function publicResult(version) {
  return {
    version,
    bank_version: "5.0.0",
    algorithm_version: "three-layer.v2.0.0",
    tag_id: version === "high_school" ? "H1" : version === "graduate" ? "G1" : "U1",
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

test("initial state exposes all three enabled identities", () => {
  const state = createPageState(runtime.registry);
  assert.equal(state.screen, "welcome");
  assert.deepEqual(state.versions.map(({ id }) => id), ["high_school", "university", "graduate"]);
});

test("native visual copy and result references remain registry and result driven", () => {
  const pageRoot = path.resolve(__dirname, "../pages/index");
  const wxml = fs.readFileSync(path.join(pageRoot, "index.wxml"), "utf8");
  const pageSource = `${wxml}\n${fs.readFileSync(path.join(pageRoot, "index.js"), "utf8")}`;

  assert.match(wxml, /\{\{versionTitles\}\}/);
  assert.match(wxml, /Q\{\{result\.self_perception\.qid\}\}/);
  assert.match(wxml, /\{\{shareSnapshot\.tag_name\}\}/);
  assert.match(wxml, /open-type="share"/);
  assert.doesNotMatch(pageSource, /高中版\s*·\s*大学版\s*·\s*硕博版/);
  assert.doesNotMatch(pageSource, /\bQ(?:[1-9]|1\d|20)\b/);
  assert.doesNotMatch(wxml, /Demo 里先展示海报结构/);
});

test("welcome presentation derives its default version and titles from the registry", () => {
  const page = pageView(createPageState(runtime.registry));

  page.syncView();

  assert.equal(page.data.activeVersion.id, runtime.registry.default_version);
  const enabledTitles = runtime.registry.versions.filter(({ enabled }) => enabled).map(({ title }) => title);
  assert.equal(page.data.versionTitles, enabledTitles.join(" · "));
  assert.equal(page.data.versionList, enabledTitles.join("、"));
});

test("share poster snapshot derives visible result fields at share time", () => {
  let state = loadedState("graduate");
  state = acceptResult(state, publicResult("graduate"), currentOperation(state));
  const page = pageView(state);
  page.syncView();

  const snapshot = page.shareResult();

  assert.deepEqual(snapshot, {
    record_id: "",
    tag_id: "G1",
    tag_name: "测试人设",
    share_copy: "我测出是测试人设，来看看你的校园人设。",
    version: "graduate",
    versionTitle: "硕博版",
    bankVersion: "5.0.0"
  });
  assert.deepEqual(page.data.shareSnapshot, snapshot);
});

test("stale bank loads cannot overwrite a newer identity selection", () => {
  let state = createPageState(runtime.registry);
  state = beginVersion(state, "high_school");
  const highSchoolOperation = currentOperation(state);
  state = beginVersion(state, "graduate");
  const graduateOperation = currentOperation(state);

  const stale = acceptLoadedBank(state, runtime.banks.high_school, highSchoolOperation);
  assert.equal(stale.activeVersion.id, "graduate");
  assert.equal(stale.bank, null);

  state = acceptLoadedBank(state, runtime.banks.graduate, graduateOperation);
  assert.equal(state.screen, "quiz");
  assert.equal(state.bank.version, "graduate");
  assert.match(questionModel(state).question.text, /组会/);
});

test("stale load errors cannot send a newer identity back to the identity page", () => {
  let state = beginVersion(createPageState(runtime.registry), "high_school");
  const staleOperation = currentOperation(state);
  state = beginVersion(state, "graduate");
  assert.equal(recoverLoadError(state, "旧题库失败", staleOperation).screen, "loading");

  const current = recoverLoadError(state, "当前题库失败", currentOperation(state));
  assert.equal(current.screen, "identity");
  assert.equal(current.error, "当前题库失败");
});

test("every version has four choices through Q19 and sixteen self-perception choices at Q20", () => {
  for (const version of runtime.registry.versions.filter(({ enabled }) => enabled)) {
    let state = beginVersion(createPageState(runtime.registry), version.id);
    state = acceptLoadedBank(state, runtime.banks[version.id], currentOperation(state));
    for (let index = 0; index < 19; index += 1) {
      const model = questionModel({ ...state, questionIndex: index });
      assert.equal(model.optionCount, 4, `${version.id} Q${index + 1}`);
      assert.equal(model.selfPerceptionOnly, false);
    }
    const q20 = questionModel({ ...state, questionIndex: 19 });
    assert.equal(q20.optionCount, 16, `${version.id} Q20`);
    assert.equal(q20.selfPerceptionOnly, true);
  }
});

test("answers update only the active question and reject invalid option indices", () => {
  let state = beginVersion(createPageState(runtime.registry), "university");
  state = acceptLoadedBank(state, runtime.banks.university, currentOperation(state));
  state = selectAnswer(state, 2);
  assert.deepEqual(state.answers, { 1: 2 });
  assert.throws(() => selectAnswer(state, 9), /答案选项无效/);
});

test("first unanswered selections auto advance while review selections stay", () => {
  let state = loadedState("university");
  assert.equal(selectionNavigation(state, 0, false), "advance");
  state = selectAnswer(state, 1);
  state = previousQuestionState({ ...state, questionIndex: 1 });
  assert.equal(state.navigationMode, "review");
  assert.equal(selectionNavigation(state, 0, true), "stay");
});

test("review next returns to auto mode at the first unanswered question", () => {
  let state = loadedState("high_school");
  state = { ...state, answers: { 1: 0 }, questionIndex: 0, navigationMode: "review" };
  state = nextQuestionState(state);
  assert.equal(state.questionIndex, 1);
  assert.equal(state.navigationMode, "auto");
});

test("first unanswered Q20 selection requests submission", () => {
  const state = { ...loadedState("graduate"), questionIndex: 19 };
  assert.equal(selectionNavigation(state, 19, false), "submit");
});

test("stale submit results and errors cannot replace the current version", () => {
  let state = beginVersion(createPageState(runtime.registry), "high_school");
  state = acceptLoadedBank(state, runtime.banks.high_school, currentOperation(state));
  const oldOperation = currentOperation(state);
  state = beginVersion(state, "graduate");

  assert.equal(acceptResult(state, publicResult("high_school"), oldOperation).screen, "loading");
  assert.equal(recoverSubmitError(state, "旧错误", oldOperation).error, null);
});

test("valid public results enter result state and submission errors recover to quiz", () => {
  let state = beginVersion(createPageState(runtime.registry), "high_school");
  state = acceptLoadedBank(state, runtime.banks.high_school, currentOperation(state));
  const operation = currentOperation(state);
  const failed = recoverSubmitError({ ...state, screen: "analysis", submitting: true }, "请重试", operation);
  assert.equal(failed.screen, "quiz");
  assert.equal(failed.error, "请重试");
  assert.equal(failed.submitting, false);

  const completed = acceptResult(state, publicResult("high_school"), operation);
  assert.equal(completed.screen, "result");
  assert.equal(completed.result.tag_name, "测试人设");
  assert.throws(() => acceptResult(state, { tag_name: "半成品" }, operation), /结果数据不完整/);
});
