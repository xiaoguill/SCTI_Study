import { getBank, getVersionRegistry, login, recordShare, submitQuiz } from "./api/cloud.js";
import {
  buildAnswerPayload,
  firstUnansweredIndex,
  restoreProgressSnapshot,
  shouldAutoAdvance
} from "./answer-state.mjs";
import { hasCompleteResult, identityCardModels, isCurrentOperation, orchestrateShare, questionHint } from "./ui-model.mjs";
import { applyTheme, findVersion, progressKey } from "./version-context.mjs";

const state = {
  screen: "welcome",
  registry: null,
  activeVersion: null,
  bank: null,
  questionIndex: 0,
  answers: {},
  startTime: Date.now(),
  result: null,
  error: null,
  submitting: false
};

const app = document.querySelector("#app");
const modal = document.querySelector("#share-modal");
const root = document.documentElement;
const lastVersionKey = "campus-persona:last-version";
let operationToken = 0;
const letter = (index) => index < 26 ? String.fromCharCode(65 + index) : `${index + 1}`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;"
})[character]);
const answerForCurrent = () => state.answers[state.bank?.questions[state.questionIndex]?.id];
const currentProgressKey = () => state.activeVersion ? progressKey(state.activeVersion) : null;
const operationSnapshot = (token, version = state.activeVersion, bankVersion = state.bank?.bank_version ?? version?.bank_version ?? null) => ({
  token,
  version: version?.id ?? null,
  bankVersion,
  progressKey: version ? progressKey(version) : null
});
const currentOperation = () => operationSnapshot(operationToken);
const beginOperation = (version = state.activeVersion, bankVersion = state.bank?.bank_version ?? version?.bank_version ?? null) => {
  operationToken += 1;
  return operationSnapshot(operationToken, version, bankVersion);
};
const safeProgress = () => ({
  version: state.activeVersion?.id,
  bankVersion: state.bank?.bank_version,
  questionIndex: state.questionIndex,
  answers: state.answers,
  startTime: state.startTime
});

function restoreProgress(operation) {
  const key = operation?.progressKey;
  if (!key || !state.bank || !isCurrentOperation(operation, currentOperation())) return;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    const restored = restoreProgressSnapshot(saved, state.bank);
    if (!restored) {
      if (saved) localStorage.removeItem(key);
      return;
    }
    state.answers = restored.answers;
    const firstMissing = firstUnansweredIndex(state.bank.questions, state.answers);
    const savedIndex = Number.isInteger(restored.questionIndex)
      ? Math.max(0, Math.min(restored.questionIndex, state.bank.questions.length - 1))
      : 0;
    state.questionIndex = firstMissing === -1 ? savedIndex : firstMissing;
    state.startTime = Number.isFinite(restored.startTime) ? restored.startTime : Date.now();
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

function saveProgress(key = currentProgressKey()) {
  if (!key || !state.bank) return;
  try { localStorage.setItem(key, JSON.stringify(safeProgress())); } catch { /* 小程序端由本地缓存层接管 */ }
}

function clearProgress(key = currentProgressKey()) {
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function readLastVersion() {
  try { return localStorage.getItem(lastVersionKey); } catch { return null; }
}

function rememberVersion(versionId) {
  try { localStorage.setItem(lastVersionKey, versionId); } catch { /* ignore */ }
}

function render() {
  if (!state.registry) {
    app.innerHTML = screens.loading();
    updateDebugTabs();
    return;
  }
  if (state.screen === "quiz" && !state.bank) state.screen = "identity";
  if (state.screen === "result" && !state.result) state.screen = state.bank ? "quiz" : "identity";
  const screen = screens[state.screen] || screens.welcome;
  app.innerHTML = screen();
  updateDebugTabs();
  bindPageActions();
}

function updateDebugTabs() {
  document.querySelectorAll(".screen-tab").forEach((tab) => {
    const unavailableResult = tab.dataset.screen === "result" && !state.result;
    const unavailableQuiz = tab.dataset.screen === "quiz" && !state.bank;
    tab.hidden = unavailableResult;
    tab.disabled = unavailableQuiz;
    tab.classList.toggle("is-active", tab.dataset.screen === state.screen);
  });
}

function identityCards() {
  return identityCardModels(state.registry, state.activeVersion?.id).map((version) => `
    <button class="identity-card ${version.selected ? "is-selected" : ""}" data-action="select-version" data-version="${escapeHtml(version.id)}">
      <span class="identity-icon">${escapeHtml(version.icon)}</span>
      <span><strong class="identity-name">${escapeHtml(version.identity_name)}</strong><small class="identity-desc">${escapeHtml(version.identity_desc)}</small></span>
      <span class="checkmark">${version.selected ? "✓" : ""}</span>
    </button>`).join("");
}

function questionKicker(question) {
  if (question.result_effect === "egg_only") return "节奏破坏题 · 趣味彩蛋";
  if (question.result_effect === "self_perception_only") return "直觉自我认知 · 独立记录";
  return "日常魔法观测";
}

function incompleteResultPage() {
  return `<section class="page result-page result-error-page">
    <div class="mini-header"><button class="back-button" data-action="go-quiz">←</button><span class="mini-brand">结果待恢复</span><button class="icon-button" data-action="go-welcome">×</button></div>
    <div class="result-error" role="alert"><div class="analysis-orbit">!</div><h1 class="hero-title">结果数据不完整，请重新生成</h1><p class="hero-subtitle">你的答案仍保存在当前版本中，可以直接再次生成。</p><button class="primary-button full-width" data-action="retry-result">重新生成结果</button></div>
  </section>`;
}

const screens = {
  loading: () => `<section class="page loading-page"><div class="loading-orbit">✦</div><h1 class="hero-title">正在打开校园人设测试</h1><p class="hero-subtitle">版本信息马上就到。</p></section>`,

  welcome: () => {
    const version = state.activeVersion;
    const versions = identityCardModels(state.registry, version.id);
    const versionTitles = versions.map((item) => item.title).join(" · ");
    return `<section class="page welcome-page">
      <div>
        <div class="welcome-top"><div class="brand-mark"><span class="brand-icon">✦</span>校园人设实验室</div><span class="mini-version">${escapeHtml(versionTitles)}</span></div>
        <div class="welcome-copy">
          <p class="section-label">${escapeHtml(version.welcome_label)}</p>
          <h1 class="hero-title">测测你是哪种<br><span class="scribble">校园人设？</span></h1>
          <p class="hero-subtitle">${escapeHtml(version.welcome_copy)}</p>
        </div>
        <div class="campus-art" aria-hidden="true">
          <span class="art-spark spark-one">✦</span><span class="art-spark spark-two">✧</span><div class="art-tree"></div><div class="art-ground"></div>
          <div class="student one"><div class="student-head">⌣</div><div class="student-body"></div></div><div class="student two"><div class="student-head">•ᴗ•</div><div class="student-body"></div></div><div class="student three"><div class="student-head">◡</div><div class="student-body"></div></div>
        </div>
        <div class="hero-card"><h2>${escapeHtml(version.title)} · V${escapeHtml(version.bank_version)}</h2><p>可在 ${escapeHtml(versionTitles)} 中选择当前校园阶段。</p><div class="meta-row"><span class="meta-pill">${versions.length} 个版本可选</span><span class="meta-pill">约 3 分钟</span><span class="meta-pill">没有标准答案</span></div></div>
      </div>
      <button class="primary-button full-width" data-action="go-identity">选择身份并开始 <span>→</span></button>
    </section>`;
  },

  identity: () => {
    const version = state.activeVersion;
    const versions = identityCardModels(state.registry, version.id);
    const versionTitles = versions.map((item) => item.title).join("、");
    return `<section class="page identity-page">
      <div class="mini-header"><button class="back-button" data-action="go-welcome">←</button><span class="mini-brand">校园人设实验室</span><span></span></div>
      <p class="section-label">${versions.length} 个版本已开放</p><h1 class="hero-title">选择你的<br>校园阶段</h1><p class="hero-subtitle">当前可选：${escapeHtml(versionTitles)}。选择后加载对应校园场景。</p>
      ${state.error ? `<div class="quiz-error" role="alert">${escapeHtml(state.error)}</div>` : ""}
      <div class="identity-list">${identityCards()}</div>
      <div class="identity-tip">⌁ 选择后加载对应题库；各版本答案与进度独立保存。</div>
      <button class="primary-button full-width" data-action="select-version" data-version="${escapeHtml(version.id)}">进入${escapeHtml(version.title)}测试 →</button>
    </section>`;
  },

  quiz: () => {
    const question = state.bank.questions[state.questionIndex];
    const selected = answerForCurrent();
    const progress = Math.round(((state.questionIndex + 1) / state.bank.questions.length) * 100);
    const canRetry = state.error && firstUnansweredIndex(state.bank.questions, state.answers) === -1;
    return `<section class="page quiz-page">
      <div class="mini-header"><button class="back-button" data-action="go-identity">←</button><span class="mini-brand">${escapeHtml(state.activeVersion.quiz_label)}</span><button class="icon-button" data-action="go-welcome">×</button></div>
      <div class="quiz-topline"><span class="quiz-count">第 ${state.questionIndex + 1} 题 / 共 ${state.bank.questions.length} 题</span><span class="quiz-percent">${progress}%</span></div>
      <div class="progress-track"><div class="progress-value" style="width:${progress}%"></div></div>
      <p class="question-kicker">${escapeHtml(question.emoji_type || "✦")} ${questionKicker(question)}</p>
      <div class="question-card"><h2>${escapeHtml(question.text)}</h2><p>${questionHint(question)}</p></div>
      ${state.error ? `<div class="quiz-error" role="alert"><p>${escapeHtml(state.error)}</p>${canRetry ? `<button class="retry-button" data-action="retry-result">重新生成结果</button>` : ""}</div>` : ""}
      <div class="options-list">${question.options.map((option, index) => `<button class="option-button ${selected === index ? "is-selected" : ""}" data-option="${index}"><span class="option-letter">${letter(index)}</span><span class="option-text">${escapeHtml(option.text)}</span></button>`).join("")}</div>
      <div class="quiz-footer"><button class="text-button" data-action="prev-question" ${state.questionIndex === 0 ? "disabled" : ""}>← 上一题</button><button class="primary-button mini-next" data-action="next-question">${state.questionIndex === state.bank.questions.length - 1 ? "查看结果" : "下一题 →"}</button></div>
    </section>`;
  },

  analysis: () => `<section class="page analysis-page"><div class="analysis-orbit">✦</div><p class="section-label">${escapeHtml(state.activeVersion.quiz_label)} · 答案已收到</p><h1 class="hero-title">正在整理你的<br><span class="scribble">校园轨迹</span></h1><p class="hero-subtitle">主标签与四维计算不包含最后一道自我认知题</p><div class="analysis-steps"><span>✓ 题目完成</span><span>✓ 服务端计算</span><span>· 生成结果</span></div></section>`,

  result: () => {
    if (!hasCompleteResult(state.result)) return incompleteResultPage();
    const result = state.result;
    const descriptions = ["paragraph_1", "paragraph_2", "paragraph_3"]
      .map((field) => `<p class="result-paragraph">${escapeHtml(result.tag_full_desc[field])}</p>`)
      .join("");
    const eggs = result.easter_eggs.map((egg) => `<div class="egg-row"><strong>${escapeHtml(egg.qid)} · 趣味彩蛋</strong><span>${escapeHtml(egg.value)}</span></div>`).join("");
    const dimensions = result.dimensions.labels.map((label, index) => {
      const value = Number(result.dimensions.user_vector[index]);
      const width = Math.max(0, Math.min(100, value / 5 * 100));
      return `<div class="dimension-row"><span>${escapeHtml(label)}</span><div class="dimension-track"><div class="dimension-value" style="width:${width}%"></div></div><strong>${escapeHtml(value)}</strong></div>`;
    }).join("");
    return `<section class="page result-page">
      <div class="mini-header"><button class="back-button" data-action="go-quiz">←</button><span class="mini-brand">${escapeHtml(state.activeVersion.title)} · 测试完成</span><button class="icon-button" data-action="go-welcome">×</button></div>
      <p class="result-kicker">✦ 你的校园隐藏人设是</p>
      <div class="result-hero"><div class="result-avatar">${escapeHtml(state.activeVersion.icon)}</div><h2>${escapeHtml(result.tag_name)}</h2><p>${escapeHtml(result.tag_short_desc)}</p><div class="tags">${result.keywords.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></div>
      <div class="result-section"><h3>完整人设解读</h3>${descriptions}</div>
      <div class="result-section"><h3>你的四维度轨迹</h3><div class="dimension-bars">${dimensions}</div>${typeof result.match_method === "string" ? `<small class="match-method">${escapeHtml(result.match_method)}</small>` : ""}</div>
      <div class="result-section"><h3>你的直觉自我认知</h3><p>${escapeHtml(result.self_perception.text)}</p><small class="match-method">Q${escapeHtml(result.self_perception.qid)} · 不参与主标签和四维计算</small></div>
      <div class="result-section"><h3>趣味彩蛋</h3>${eggs}</div>
      <div class="result-section share-copy-section"><h3>分享文案</h3><p>${escapeHtml(result.share_copy)}</p></div>
      <div class="result-actions"><button class="primary-button full-width" data-action="share-result">分享我的校园人设</button><button class="secondary-button" data-action="restart">重新测试</button></div>
    </section>`;
  }
};

async function loadVersion(versionId, { enterQuiz = true } = {}) {
  const token = operationToken + 1;
  operationToken = token;
  let version;
  try {
    version = findVersion(state.registry, versionId);
  } catch (error) {
    if (token !== operationToken) return;
    state.error = error.message;
    state.screen = "identity";
    render();
    return;
  }
  const operation = operationSnapshot(token, version, version.bank_version);

  state.activeVersion = version;
  applyTheme(root, version);
  state.bank = null;
  state.questionIndex = 0;
  state.answers = {};
  state.startTime = Date.now();
  state.result = null;
  state.error = null;
  state.submitting = false;
  state.screen = "loading";
  render();

  try {
    const bank = await getBank(operation.version);
    if (!isCurrentOperation(operation, currentOperation())) return;
    if (bank.version !== operation.version || bank.bank_version !== operation.bankVersion) {
      throw new Error("题库版本不匹配，请重新选择测试版本");
    }
    state.bank = bank;
    restoreProgress(operation);
    rememberVersion(version.id);
    state.screen = enterQuiz ? "quiz" : "welcome";
  } catch (error) {
    if (!isCurrentOperation(operation, currentOperation())) return;
    state.error = error.message || "题库加载失败";
    state.screen = "identity";
  }
  if (!isCurrentOperation(operation, currentOperation())) return;
  render();
}

async function finishQuiz() {
  if (state.submitting || !state.bank || !state.activeVersion) return;
  let answers;
  try {
    answers = buildAnswerPayload(state.bank.questions, state.answers);
  } catch (error) {
    state.questionIndex = Number.isInteger(error.questionIndex) ? error.questionIndex : state.questionIndex;
    state.error = error.message || "请完成全部题目后再查看结果";
    state.screen = "quiz";
    saveProgress();
    render();
    return;
  }

  const operation = beginOperation(state.activeVersion, state.bank.bank_version);
  state.submitting = true;
  state.error = null;
  state.screen = "analysis";
  render();
  try {
    const response = await submitQuiz({
      version: operation.version,
      bank_version: operation.bankVersion,
      answers,
      duration_seconds: Math.round((Date.now() - state.startTime) / 1000)
    });
    if (!isCurrentOperation(operation, currentOperation())) return;
    if (response.code !== 0) throw new Error(response.message || "结果计算失败");
    if (!hasCompleteResult(response.data?.server_result)) throw new Error("结果数据不完整，请重新生成");
    state.result = { ...response.data.server_result, record_id: response.data.record_id };
    state.screen = "result";
    clearProgress(operation.progressKey);
  } catch (error) {
    if (!isCurrentOperation(operation, currentOperation())) return;
    state.result = null;
    state.error = error.message || "结果计算失败，请重新生成结果";
    state.screen = "quiz";
    saveProgress(operation.progressKey);
  } finally {
    if (!isCurrentOperation(operation, currentOperation())) return;
    state.submitting = false;
    render();
  }
}

function bindPageActions() {
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button)));
  app.querySelectorAll("[data-option]").forEach((button) => button.addEventListener("click", () => {
    const answeredIndex = state.questionIndex;
    const runtime = currentOperation();
    state.answers[state.bank.questions[answeredIndex].id] = Number(button.dataset.option);
    state.error = null;
    saveProgress();
    render();
    window.setTimeout(() => {
      if (!isCurrentOperation(runtime, currentOperation())) return;
      if (!shouldAutoAdvance(state.screen, state.questionIndex, answeredIndex)) return;
      if (state.questionIndex === state.bank.questions.length - 1) finishQuiz();
      else {
        state.questionIndex += 1;
        saveProgress();
        render();
      }
    }, 280);
  }));
}

function handleAction(button) {
  const action = button.dataset.action;
  if (action === "go-welcome") state.screen = "welcome";
  if (action === "go-identity") state.screen = "identity";
  if (action === "go-quiz") state.screen = state.bank ? "quiz" : "identity";
  if (action === "select-version") {
    loadVersion(button.dataset.version);
    return;
  }
  if (action === "prev-question" && state.questionIndex > 0) {
    state.questionIndex -= 1;
    saveProgress();
  }
  if (action === "next-question") {
    if (answerForCurrent() === undefined) return;
    if (state.questionIndex === state.bank.questions.length - 1) {
      finishQuiz();
      return;
    }
    state.questionIndex += 1;
    saveProgress();
  }
  if (action === "retry-result") {
    finishQuiz();
    return;
  }
  if (action === "restart") {
    clearProgress();
    state.screen = "identity";
    state.questionIndex = 0;
    state.answers = {};
    state.result = null;
    state.error = null;
    state.startTime = Date.now();
  }
  if (action === "share-result") shareResult();
  render();
}

function updateShareModal(shareSnapshot) {
  modal.querySelector("[data-share-version]").textContent = shareSnapshot.versionTitle;
  modal.querySelector("[data-share-tag]").textContent = shareSnapshot.tag_name;
  modal.querySelector("[data-share-copy]").textContent = shareSnapshot.share_copy;
  modal.querySelector("[data-share-hashtags]").textContent = `#${shareSnapshot.versionTitle} #校园人设测试 #${shareSnapshot.tag_name}`;
}

function setShareFeedback(message = "") {
  const feedback = modal.querySelector("[data-share-feedback]");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = !message;
}

async function shareResult() {
  const result = state.result;
  const activeVersion = state.activeVersion;
  const bankVersion = state.bank?.bank_version;
  if (!result || !activeVersion || !bankVersion) return;

  const operation = Object.freeze(currentOperation());
  const shareSnapshot = Object.freeze({
    record_id: result.record_id,
    tag_id: result.tag_id,
    tag_name: result.tag_name,
    share_copy: result.share_copy,
    version: activeVersion.id,
    versionTitle: activeVersion.title,
    bankVersion
  });
  const nativeShare = typeof globalThis.navigator?.share === "function"
    ? globalThis.navigator.share.bind(globalThis.navigator)
    : null;
  const sharePayload = Object.freeze({
    title: `我是「${shareSnapshot.tag_name}」`,
    text: shareSnapshot.share_copy,
    url: window.location.href
  });

  try {
    const outcome = await orchestrateShare({
      operation,
      isCurrent: (snapshot) => isCurrentOperation(snapshot, currentOperation()),
      recordShare,
      recordPayload: Object.freeze({
        record_id: shareSnapshot.record_id,
        tag_id: shareSnapshot.tag_id,
        share_type: "forward",
        share_platform: "wechat"
      }),
      nativeShare,
      sharePayload
    });
    if (outcome.status === "stale" || !isCurrentOperation(operation, currentOperation())) return;

    state.error = outcome.feedback || null;
    if (!outcome.showModal) return;
    updateShareModal(shareSnapshot);
    setShareFeedback(outcome.feedback);
    modal.hidden = false;
  } catch {
    if (!isCurrentOperation(operation, currentOperation())) return;
    state.error = "分享暂时不可用，请稍后重试。";
    updateShareModal(shareSnapshot);
    setShareFeedback(state.error);
    modal.hidden = false;
  }
}

document.querySelectorAll(".screen-tab").forEach((tab) => tab.addEventListener("click", () => {
  if (tab.dataset.screen === "result" && !state.result) return;
  if (tab.dataset.screen === "quiz" && !state.bank) return;
  state.screen = tab.dataset.screen;
  render();
}));
modal.querySelectorAll("[data-action='close-modal']").forEach((button) => button.addEventListener("click", () => { modal.hidden = true; }));
modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });

async function boot() {
  render();
  try {
    state.registry = await getVersionRegistry();
    const savedVersionId = readLastVersion();
    let initialVersion;
    let restorableVersionId = null;
    try {
      initialVersion = findVersion(state.registry, savedVersionId || state.registry.default_version);
      if (savedVersionId) restorableVersionId = savedVersionId;
    } catch {
      try {
        initialVersion = findVersion(state.registry, state.registry.default_version);
      } catch {
        initialVersion = identityCardModels(state.registry, null)[0];
      }
      try { localStorage.removeItem(lastVersionKey); } catch { /* ignore */ }
    }
    if (!initialVersion) throw new Error("没有可用的测试版本");
    state.activeVersion = initialVersion;
    applyTheme(root, initialVersion);
    render();
    login().catch(() => undefined);
    if (restorableVersionId) await loadVersion(restorableVersionId, { enterQuiz: false });
  } catch (error) {
    state.error = error.message || "版本列表加载失败";
    app.innerHTML = `<section class="page loading-page"><div class="loading-orbit">!</div><h1 class="hero-title">版本列表加载失败</h1><p class="hero-subtitle">${escapeHtml(state.error)}</p></section>`;
  }
}

boot();
