import { getBank, login, recordShare, submitQuiz } from "./api/cloud.js";
import {
  buildAnswerPayload,
  firstUnansweredIndex,
  normalizeStoredAnswers,
  shouldAutoAdvance
} from "./answer-state.mjs";

const state = {
  screen: "welcome",
  bank: null,
  questionIndex: 0,
  answers: {},
  startTime: Date.now(),
  result: null,
  error: null
};

const app = document.querySelector("#app");
const modal = document.querySelector("#share-modal");

const progressKey = "campus-persona-university-progress-v5.0.1";
const letter = (index) => index < 26 ? String.fromCharCode(65 + index) : `${index + 1}`;
const answerForCurrent = () => state.answers[state.bank?.questions[state.questionIndex]?.id];
const safeProgress = () => ({
  bankVersion: state.bank?.bank_version,
  questionIndex: state.questionIndex,
  answers: state.answers,
  startTime: state.startTime
});

function restoreProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey) || "null");
    if (!saved || !saved.answers) return;
    if (saved.bankVersion && saved.bankVersion !== state.bank.bank_version) {
      clearProgress();
      return;
    }
    state.answers = normalizeStoredAnswers(state.bank.questions, saved.answers);
    const firstMissing = firstUnansweredIndex(state.bank.questions, state.answers);
    const savedIndex = Number.isInteger(saved.questionIndex)
      ? Math.max(0, Math.min(saved.questionIndex, state.bank.questions.length - 1))
      : 0;
    state.questionIndex = firstMissing === -1 ? savedIndex : firstMissing;
    state.startTime = Number.isFinite(saved.startTime) ? saved.startTime : Date.now();
  } catch { /* 浏览器缓存损坏时从头开始 */ }
}

function saveProgress() {
  try { localStorage.setItem(progressKey, JSON.stringify(safeProgress())); } catch { /* 小程序端由本地缓存层接管 */ }
}

function clearProgress() {
  try { localStorage.removeItem(progressKey); } catch { /* ignore */ }
}

function render() {
  if (!state.bank) {
    app.innerHTML = `<section class="page loading-page"><div class="loading-orbit">✦</div><h1 class="hero-title">正在打开大学版</h1><p class="hero-subtitle">题库和校园灵感马上就到。</p></section>`;
    return;
  }
  app.innerHTML = screens[state.screen]();
  document.querySelectorAll(".screen-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.screen === state.screen);
  });
  bindPageActions();
}

const screens = {
  welcome: () => `
    <section class="page welcome-page">
      <div>
        <div class="welcome-top"><div class="brand-mark"><span class="brand-icon">✦</span>校园人设实验室</div><span class="mini-version">V5.0.1</span></div>
        <div class="welcome-copy">
          <p class="section-label">大学版 · 趣味校园人格测试</p>
          <h1 class="hero-title">测测你是哪种<br><span class="scribble">校园人设？</span></h1>
          <p class="hero-subtitle">20 道轻松小题，发现那个<br>连你自己都没注意到的隐藏身份。</p>
        </div>
        <div class="campus-art" aria-hidden="true">
          <span class="art-spark spark-one">✦</span><span class="art-spark spark-two">✧</span><div class="art-tree"></div><div class="art-ground"></div>
          <div class="student one"><div class="student-head">⌣</div><div class="student-body"></div></div><div class="student two"><div class="student-head">•ᴗ•</div><div class="student-body"></div></div><div class="student three"><div class="student-head">◡</div><div class="student-body"></div></div>
        </div>
        <div class="hero-card"><h2>大学版 · V5.0.1</h2><p>后端三层算法计算结果，前端只负责轻松答题。</p><div class="meta-row"><span class="meta-pill">20 道题</span><span class="meta-pill">约 3 分钟</span><span class="meta-pill">没有标准答案</span></div></div>
      </div>
      <button class="primary-button full-width" data-action="go-identity">开始大学版测试 <span>→</span></button>
    </section>`,

  identity: () => `
    <section class="page identity-page">
      <div class="mini-header"><button class="back-button" data-action="go-welcome">←</button><span class="mini-brand">校园人设实验室</span><span></span></div>
      <p class="section-label">V5.0 MVP · 版本确认</p><h1 class="hero-title">这次测的是<br>大学版人设</h1><p class="hero-subtitle">高中版和硕博版会在后续版本开放，先从大学生活开始。</p>
      <div class="identity-list"><button class="identity-card is-selected" data-action="go-quiz"><span class="identity-icon">⌂</span><span><strong class="identity-name">大学生</strong><small class="identity-desc">本科 / 专科阶段 · 20 道大学场景题</small></span><span class="checkmark">✓</span></button></div>
      <div class="identity-tip">⌁ 选择完成后自动进入答题。你的最终结果由云函数三层算法计算。</div>
      <button class="primary-button full-width" data-action="go-quiz">进入大学版测试 →</button>
    </section>`,

  quiz: () => {
    const question = state.bank.questions[state.questionIndex];
    const selected = answerForCurrent();
    const progress = Math.round(((state.questionIndex + 1) / state.bank.questions.length) * 100);
    return `<section class="page quiz-page">
      <div class="mini-header"><button class="back-button" data-action="go-identity">←</button><span class="mini-brand">大学版 · V5.0.1</span><button class="icon-button" data-action="go-welcome">×</button></div>
      <div class="quiz-topline"><span class="quiz-count">第 ${state.questionIndex + 1} 题 / 共 ${state.bank.questions.length} 题</span><span class="quiz-percent">${progress}%</span></div>
      <div class="progress-track"><div class="progress-value" style="width:${progress}%"></div></div>
      <p class="question-kicker">${question.emoji_type || "✦"} ${question.result_effect === "egg_only" ? "节奏破坏题 · 趣味彩蛋" : "日常魔法观测"}</p>
      <div class="question-card"><h2>${question.text}</h2><p>${question.result_effect === "egg_only" ? "这一题不影响主标签，答案会成为你的结果彩蛋。" : "先别想太久，第一反应往往最像你。"}</p></div>
      ${state.error ? `<p class="quiz-error" role="alert">${state.error}</p>` : ""}
      <div class="options-list">${question.options.map((option, index) => `<button class="option-button ${selected === index ? "is-selected" : ""}" data-option="${index}"><span class="option-letter">${letter(index)}</span><span class="option-text">${option.text}</span></button>`).join("")}</div>
      <div class="quiz-footer"><button class="text-button" data-action="prev-question" ${state.questionIndex === 0 ? "disabled" : ""}>← 上一题</button><button class="primary-button mini-next" data-action="next-question">${state.questionIndex === state.bank.questions.length - 1 ? "查看结果" : "下一题 →"}</button></div>
    </section>`;
  },

  analysis: () => `<section class="page analysis-page"><div class="analysis-orbit">✦</div><p class="section-label">答案已收到</p><h1 class="hero-title">正在整理你的<br><span class="scribble">校园轨迹</span></h1><p class="hero-subtitle">核心定选题 → 得分累积 → 四维度匹配</p><div class="analysis-steps"><span>✓ 题目完成</span><span>✓ 云端计算</span><span>· 生成结果</span></div></section>`,

  result: () => {
    const result = state.result;
    const dims = result.dimensions || { labels: ["学业投入度", "社交活跃度", "自律执行力", "探索开放性"], user_vector: [3, 3, 3, 3] };
    const descriptions = result.tag_full_desc || {};
    const eggs = (result.easter_eggs || []).map((egg) => `<div class="egg-row"><strong>${egg.qid} · 趣味彩蛋</strong><span>${egg.value}</span></div>`).join("");
    return `<section class="page result-page">
      <div class="mini-header"><button class="back-button" data-action="go-quiz">←</button><span class="mini-brand">测试完成</span><button class="icon-button" data-action="go-welcome">×</button></div>
      <p class="result-kicker">✦ 你的校园隐藏人设是</p>
      <div class="result-hero"><div class="result-avatar">☁</div><h2>${result.tag_name}</h2><p>${result.tag_short_desc}</p><div class="tags">${(result.keywords || []).map((tag) => `<span class="tag">${tag}</span>`).join("")}</div></div>
      <div class="result-section"><h3>你的四维度轨迹</h3><div class="dimension-bars">${dims.labels.map((label, index) => { const value = dims.user_vector[index] || 0; return `<div class="dimension-row"><span>${label.replace("度", "")}</span><div class="dimension-track"><div class="dimension-value" style="width:${Math.max(8, value / 5 * 100)}%"></div></div><strong>${value}</strong></div>`; }).join("")}</div><small class="match-method">${result.match_method === "local_demo" ? "浏览器本地演示回包" : `服务端 ${result.match_method} 匹配`}</small></div>
      <div class="result-section"><h3>你可能会这样</h3><p>${descriptions.paragraph_1 || "你的大学生活正在形成独特的轨迹。"}</p></div>
      <div class="result-section"><h3>你的隐藏优势</h3><p>${descriptions.paragraph_2 || "你有一套属于自己的节奏。"}</p></div>
      ${eggs ? `<div class="result-section"><h3>趣味彩蛋</h3>${eggs}</div>` : ""}
      <div class="result-actions"><button class="primary-button full-width" data-action="share-result">分享我的校园人设</button><button class="secondary-button" data-action="restart">重新测试</button></div>
    </section>`;
  }
};

async function finishQuiz() {
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
  state.error = null;
  state.screen = "analysis";
  render();
  try {
    const response = await submitQuiz({ version: "university", answers, duration_seconds: Math.round((Date.now() - state.startTime) / 1000) });
    if (response.code !== 0) {
      state.error = response.message || "结果计算失败";
      state.screen = "quiz";
      render();
      return;
    }
    state.result = response.data.server_result;
    state.result.record_id = response.data.record_id;
    state.screen = "result";
    clearProgress();
    render();
  } catch (error) {
    state.error = error.message || "结果计算失败";
    state.screen = "quiz";
    render();
  }
}

function bindPageActions() {
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
  document.querySelectorAll("[data-option]").forEach((button) => button.addEventListener("click", () => {
    const answeredIndex = state.questionIndex;
    state.answers[state.bank.questions[answeredIndex].id] = Number(button.dataset.option);
    state.error = null;
    saveProgress();
    render();
    window.setTimeout(() => {
      if (!shouldAutoAdvance(state.screen, state.questionIndex, answeredIndex)) return;
      if (state.questionIndex === state.bank.questions.length - 1) finishQuiz();
      else { state.questionIndex += 1; saveProgress(); render(); }
    }, 280);
  }));
}

function handleAction(action) {
  if (action === "go-welcome") state.screen = "welcome";
  if (action === "go-identity") state.screen = "identity";
  if (action === "go-quiz") { state.screen = "quiz"; state.error = null; }
  if (action === "prev-question" && state.questionIndex > 0) { state.questionIndex -= 1; saveProgress(); }
  if (action === "next-question") {
    if (answerForCurrent() === undefined) return;
    if (state.questionIndex === state.bank.questions.length - 1) finishQuiz();
    else { state.questionIndex += 1; saveProgress(); }
  }
  if (action === "restart") { clearProgress(); state.screen = "identity"; state.questionIndex = 0; state.answers = {}; state.result = null; state.startTime = Date.now(); }
  if (action === "share-result") shareResult();
  if (action === "close-modal") modal.hidden = true;
  render();
}

async function shareResult() {
  if (!state.result) return;
  await recordShare({ record_id: state.result.record_id, tag_id: state.result.tag_id, share_type: "forward", share_platform: "wechat" });
  if (navigator.share) {
    await navigator.share({ title: `我是「${state.result.tag_name}」`, text: state.result.tag_short_desc, url: window.location.href }).catch(() => undefined);
  } else {
    modal.hidden = false;
  }
}

document.querySelectorAll(".screen-tab").forEach((tab) => tab.addEventListener("click", () => { state.screen = tab.dataset.screen; render(); }));
modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });

getBank().then((bank) => {
  state.bank = bank;
  restoreProgress();
  login().catch(() => undefined);
  render();
}).catch((error) => {
  state.error = error.message;
  app.innerHTML = `<section class="page loading-page"><div class="loading-orbit">!</div><h1 class="hero-title">题库加载失败</h1><p class="hero-subtitle">${state.error}</p></section>`;
});
