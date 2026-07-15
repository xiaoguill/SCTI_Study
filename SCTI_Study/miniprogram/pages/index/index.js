const runtimeConfig = require("../../config/runtime");
const nativeRuntime = require("../../data/runtime");
const { createQuizService } = require("../../services/quiz-service");
const { buildAnswerPayload, normalizeStoredAnswers } = require("../../utils/answer-state");
const { resolvePersonaPresentation } = require("../../utils/persona-presentation");
const { buildResultPosterModel } = require("../../utils/result-poster-model");
const { createSelectionFlow } = require("../../utils/selection-flow");
const { progressKey } = require("../../utils/version-context");
const {
  acceptLoadedBank,
  acceptResult,
  beginVersion,
  createPageState,
  currentOperation,
  isCurrentOperation,
  nextQuestionState,
  previousQuestionState,
  questionModel,
  recoverLoadError,
  recoverSubmitError,
  selectionNavigation,
  selectAnswer
} = require("./controller");

const optionLetter = (index) => String.fromCharCode(65 + index);
const identityIconColors = ["#ffd6df", "#cdeeff", "#e7d8ff"];

Page({
  data: {
    screen: "welcome",
    versions: [],
    activeVersion: null,
    versionTitles: "",
    versionList: "",
    question: null,
    questionNumber: 0,
    questionTotal: 20,
    progress: 0,
    options: [],
    questionKicker: "",
    questionHint: "",
    canGoPrevious: false,
    showManualNext: false,
    canRetry: false,
    error: null,
    submitting: false,
    result: null,
    character: resolvePersonaPresentation(nativeRuntime.presentation, "", "", "✦"),
    descriptions: [],
    dimensionRows: [],
    shareFallbackVisible: false,
    shareSnapshot: null,
    posterModel: null,
    shareFeedback: "",
    themeStyle: "--version-accent:#f3a8c2;--version-accent-light:#fde3ed;--version-card:#fff0a8;",
    localMode: runtimeConfig.runtimeMode(runtimeConfig) === "local",
    serviceStatus: "checking",
    serviceMessage: "正在检查本地结果服务"
  },

  onLoad() {
    this.quizService = createQuizService({ wxApi: wx, runtimeConfig, nativeRuntime });
    this.selectionFlow = createSelectionFlow({ setTimer: setTimeout, clearTimer: clearTimeout });
    this.runtimeState = createPageState(nativeRuntime.registry);
    this.syncView();
    this.checkServiceHealth();
  },

  onUnload() {
    this.clearPendingAdvance();
  },

  syncView() {
    const state = this.runtimeState;
    const activeVersion = state.activeVersion
      || state.versions.find((version) => version.id === state.registry.default_version)
      || state.versions[0]
      || null;
    const theme = activeVersion?.theme || { accent: "#f3a8c2", accent_light: "#fde3ed", card: "#fff0a8" };
    let question = null;
    let options = [];
    let progress = 0;
    let selfPerceptionOnly = false;
    let questionKicker = "";
    let questionHint = "";
    if (state.bank && state.screen === "quiz") {
      const model = questionModel(state);
      question = model.question;
      selfPerceptionOnly = model.selfPerceptionOnly;
      const effectLabel = question.result_effect === "egg_only"
        ? "节奏破坏题 · 趣味彩蛋"
        : question.result_effect === "self_perception_only"
          ? "直觉自我认知 · 独立记录"
          : "日常魔法观测";
      questionKicker = `${question.emoji_type || "✦"} ${effectLabel}`;
      questionHint = question.result_effect === "egg_only"
        ? "这一题不影响主标签，答案会成为你的结果彩蛋。"
        : question.result_effect === "self_perception_only"
          ? "这一题用于记录你的直觉自我认知，不参与主标签和四维计算。"
          : "先别想太久，第一反应往往最像你。";
      const selected = state.answers[question.id];
      options = question.options.map((option, index) => ({
        ...option,
        letter: optionLetter(index),
        selected: selected === index
      }));
      progress = Math.round(((state.questionIndex + 1) / state.bank.questions.length) * 100);
    }
    const result = state.result;
    const character = resolvePersonaPresentation(
      nativeRuntime.presentation,
      activeVersion?.id || "",
      result?.tag_id || "",
      activeVersion?.icon
    );
    const descriptions = result
      ? [result.tag_full_desc.paragraph_1, result.tag_full_desc.paragraph_2, result.tag_full_desc.paragraph_3]
      : [];
    const dimensionRows = result
      ? result.dimensions.labels.map((label, index) => ({
        label,
        value: result.dimensions.user_vector[index],
        width: `${Math.max(0, Math.min(100, result.dimensions.user_vector[index] / 5 * 100))}%`
      }))
      : [];
    if (this.failedCharacterSource === character.character_image) character.character_image = "";
    const posterModel = result ? buildResultPosterModel(result, character, activeVersion) : null;
    this.setData({
      screen: state.screen,
      versions: state.versions.map((version, index) => ({
        ...version,
        selected: version.id === activeVersion?.id,
        cardStyle: `--identity-icon:${identityIconColors[index % identityIconColors.length]};`
      })),
      activeVersion,
      versionTitles: state.versions.map((version) => version.title).join(" · "),
      versionList: state.versions.map((version) => version.title).join("、"),
      question,
      questionNumber: state.questionIndex + 1,
      questionTotal: state.bank?.questions.length || 20,
      progress,
      options,
      selfPerceptionOnly,
      questionKicker,
      questionHint,
      canGoPrevious: state.questionIndex > 0,
      showManualNext: state.navigationMode === "review",
      canRetry: Boolean(
        state.error
        && state.bank
        && state.bank.questions.every((item) => Number.isInteger(state.answers[item.id]))
      ),
      error: state.error,
      submitting: state.submitting,
      result,
      character,
      descriptions,
      dimensionRows,
      posterModel,
      themeStyle: `--version-accent:${theme.accent};--version-accent-light:${theme.accent_light};--version-card:${theme.card};`
    });
  },

  invalidateAndShow(screen) {
    this.clearPendingAdvance();
    this.setData({ shareFallbackVisible: false, shareFeedback: "" });
    this.runtimeState = {
      ...this.runtimeState,
      generation: this.runtimeState.generation + 1,
      screen,
      bank: screen === "welcome" ? null : this.runtimeState.bank,
      result: null,
      error: null,
      submitting: false
    };
    this.invalidateServiceHealth();
    this.syncView();
  },

  showWelcome() {
    this.invalidateAndShow("welcome");
  },

  showIdentity() {
    this.invalidateAndShow("identity");
  },

  async selectVersion(event) {
    await this.loadVersion(event.currentTarget.dataset.version);
  },

  async loadVersion(versionId) {
    let operation = null;
    try {
      this.clearPendingAdvance();
      this.runtimeState = beginVersion(this.runtimeState, versionId);
      this.invalidateServiceHealth();
      operation = currentOperation(this.runtimeState);
      this.syncView();
      const bank = await this.quizService.getBank(operation.version, "");
      if (!isCurrentOperation(this.runtimeState, operation)) return;
      this.runtimeState = acceptLoadedBank(this.runtimeState, bank, operation);
      this.restoreProgress();
      this.syncView();
    } catch (error) {
      if (operation && !isCurrentOperation(this.runtimeState, operation)) return;
      this.runtimeState = operation
        ? recoverLoadError(this.runtimeState, error.message, operation)
        : { ...this.runtimeState, screen: "identity", error: error.message || "题库加载失败" };
      this.syncView();
    }
  },

  restoreProgress() {
    const state = this.runtimeState;
    const key = progressKey(state.activeVersion);
    const snapshot = wx.getStorageSync(key);
    if (!snapshot || snapshot.version !== state.bank.version || snapshot.bankVersion !== state.bank.bank_version) return;
    const questionIndex = Math.max(0, Math.min(state.bank.questions.length - 1, Number(snapshot.questionIndex) || 0));
    const answers = normalizeStoredAnswers(state.bank.questions, snapshot.answers);
    const currentQuestion = state.bank.questions[questionIndex];
    this.runtimeState = {
      ...state,
      questionIndex,
      answers,
      navigationMode: Number.isInteger(answers[currentQuestion.id]) ? "review" : "auto"
    };
  },

  saveProgress() {
    const state = this.runtimeState;
    if (!state.activeVersion || !state.bank) return;
    wx.setStorageSync(progressKey(state.activeVersion), {
      version: state.bank.version,
      bankVersion: state.bank.bank_version,
      questionIndex: state.questionIndex,
      answers: state.answers
    });
  },

  selectOption(event) {
    try {
      this.clearPendingAdvance();
      const state = this.runtimeState;
      const selectedAnswer = Number(event.currentTarget.dataset.index);
      const questionIndex = state.questionIndex;
      const question = state.bank.questions[questionIndex];
      const wasAnswered = Number.isInteger(state.answers[question.id]);
      const operation = currentOperation(state);

      this.runtimeState = selectAnswer(state, selectedAnswer);
      this.saveProgress();
      this.syncView();

      const action = selectionNavigation(this.runtimeState, questionIndex, wasAnswered);
      if (action !== "stay") {
        this.scheduleSelectionContinuation({
          token: `${operation.version}:${operation.bankVersion}:${operation.generation}:${questionIndex}:${selectedAnswer}`,
          operation,
          questionIndex,
          selectedAnswer,
          action
        });
      }
    } catch (error) {
      wx.showToast({ title: error.message || "答案选项无效", icon: "none" });
    }
  },

  previousQuestion() {
    this.clearPendingAdvance();
    const previous = previousQuestionState(this.runtimeState);
    if (previous === this.runtimeState) return;
    this.runtimeState = previous;
    this.saveProgress();
    this.syncView();
    this.scrollQuestionTop();
  },

  nextQuestion() {
    this.clearPendingAdvance();
    const state = this.runtimeState;
    let next;
    try {
      next = nextQuestionState(state);
    } catch (error) {
      this.runtimeState = { ...state, error: error.message };
      this.syncView();
      return;
    }
    if (next === state) {
      this.finishQuiz();
      return;
    }
    this.runtimeState = next;
    this.saveProgress();
    this.syncView();
    this.scrollQuestionTop();
  },

  async finishQuiz() {
    this.clearPendingAdvance();
    const state = this.runtimeState;
    if (state.submitting || !state.bank || !state.activeVersion) return;
    let answers;
    try {
      answers = buildAnswerPayload(state.bank.questions, state.answers);
    } catch (error) {
      this.runtimeState = { ...state, screen: "quiz", questionIndex: error.questionIndex, error: error.message };
      this.saveProgress();
      this.syncView();
      return;
    }
    const operation = currentOperation(state);
    this.runtimeState = { ...state, screen: "analysis", submitting: true, error: null };
    this.syncView();
    try {
      const response = await this.quizService.submitQuiz({
        version: operation.version,
        bank_version: operation.bankVersion,
        answers
      });
      if (!isCurrentOperation(this.runtimeState, operation)) return;
      if (response.code !== 0) throw new Error(response.message || "结果计算失败");
      const result = { ...response.data?.server_result, record_id: response.data?.record_id || "" };
      this.runtimeState = acceptResult(this.runtimeState, result, operation);
      wx.removeStorageSync(progressKey(this.runtimeState.activeVersion));
    } catch (error) {
      this.runtimeState = recoverSubmitError(this.runtimeState, error.message, operation);
      this.saveProgress();
    }
    this.syncView();
  },

  retryResult() {
    this.finishQuiz();
  },

  invalidateServiceHealth() {
    if (this.data.localMode && this.data.serviceStatus === "checking") {
      this.setData({
        serviceStatus: "offline",
        serviceMessage: "本地结果服务状态已过期，请重新检查"
      });
    }
  },

  async checkServiceHealth() {
    const operation = currentOperation(this.runtimeState);
    this.setData({ serviceStatus: "checking", serviceMessage: "正在检查本地结果服务" });
    try {
      const health = await this.quizService.checkHealth();
      if (!isCurrentOperation(this.runtimeState, operation)) return;
      this.setData({ serviceStatus: health.status, serviceMessage: health.message });
    } catch {
      if (!isCurrentOperation(this.runtimeState, operation)) return;
      this.setData({
        serviceStatus: "offline",
        serviceMessage: "本地结果服务不可用，请运行 frontend-demo 的 npm start 后重试"
      });
    }
  },

  retryServiceHealth() {
    this.checkServiceHealth();
  },

  restart() {
    this.clearPendingAdvance();
    this.setData({ shareFallbackVisible: false, shareFeedback: "" });
    if (this.runtimeState.activeVersion) this.loadVersion(this.runtimeState.activeVersion.id);
    else this.showIdentity();
  },

  backToQuiz() {
    this.clearPendingAdvance();
    this.setData({ shareFallbackVisible: false, shareFeedback: "" });
    this.runtimeState = { ...this.runtimeState, screen: "quiz", result: null, error: null };
    this.syncView();
  },

  clearPendingAdvance() {
    if (this.selectionFlow) this.selectionFlow.cancel();
  },

  scheduleSelectionContinuation(snapshot) {
    this.selectionFlow.schedule({
      token: snapshot.token,
      action: snapshot.action,
      run: (action, token) => {
        const state = this.runtimeState;
        const question = state.bank?.questions?.[snapshot.questionIndex];
        if (
          token !== snapshot.token
          || state.screen !== "quiz"
          || state.questionIndex !== snapshot.questionIndex
          || !isCurrentOperation(state, snapshot.operation)
          || !question
          || state.answers[question.id] !== snapshot.selectedAnswer
        ) return;

        if (action === "submit") {
          this.finishQuiz();
          return;
        }

        try {
          this.runtimeState = nextQuestionState(state);
        } catch (error) {
          this.runtimeState = { ...state, error: error.message };
          this.syncView();
          return;
        }
        this.saveProgress();
        this.syncView();
        this.scrollQuestionTop();
      }
    });
  },

  scrollQuestionTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  shareResult() {
    const state = this.runtimeState;
    const result = state?.result;
    const activeVersion = state?.activeVersion;
    const bankVersion = state?.bank?.bank_version;
    if (state?.screen !== "result" || !result || !activeVersion || !bankVersion) return null;
    const snapshot = {
      record_id: result.record_id || "",
      tag_id: result.tag_id,
      tag_name: result.tag_name,
      share_copy: result.share_copy,
      version: activeVersion.id,
      versionTitle: activeVersion.title,
      bankVersion
    };
    this.setData({ shareSnapshot: snapshot, shareFeedback: "" });
    return snapshot;
  },

  isCurrentResultSnapshot(snapshot) {
    const state = this.runtimeState;
    const result = state?.result;
    return Boolean(
      snapshot
      && state?.screen === "result"
      && result
      && state.activeVersion?.id === snapshot.version
      && state.bank?.bank_version === snapshot.bankVersion
      && (result.record_id || "") === snapshot.record_id
      && result.tag_id === snapshot.tag_id
      && result.tag_name === snapshot.tag_name
      && result.share_copy === snapshot.share_copy
    );
  },

  openShareFallback() {
    const snapshot = this.shareResult();
    if (!snapshot) return null;
    this.showShareFallback("", snapshot);
    return snapshot;
  },

  previewPosterModel() {
    if (!this.data.posterModel) return null;
    wx.showToast({ title: "海报图片尚未生成", icon: "none" });
    return this.data.posterModel;
  },

  handleCharacterError(event) {
    const failedSource = event?.currentTarget?.dataset?.src || event?.detail?.src || "";
    if (!failedSource || failedSource !== this.data.character?.character_image) return;
    this.failedCharacterSource = failedSource;
    this.setData({ character: { ...this.data.character, character_image: "" } });
  },

  showShareFallback(message, snapshot = this.data.shareSnapshot) {
    if (!this.isCurrentResultSnapshot(snapshot)) return;
    this.setData({
      shareSnapshot: snapshot,
      shareFeedback: message || "",
      shareFallbackVisible: true
    });
  },

  closeShareFallback() {
    this.setData({ shareFallbackVisible: false });
  },

  stopPropagation() {},

  onShareAppMessage() {
    const snapshot = this.shareResult();
    const operation = currentOperation(this.runtimeState);
    if (snapshot) {
      Promise.resolve(this.quizService.recordShare({ record_id: snapshot.record_id, tag_id: snapshot.tag_id }))
        .then((response) => {
          if (!isCurrentOperation(this.runtimeState, operation)) return;
          if (response?.code !== 0) this.showShareFallback(response?.message || "分享记录失败，请稍后重试。", snapshot);
        })
        .catch(() => {
          if (isCurrentOperation(this.runtimeState, operation)) {
            this.showShareFallback("分享记录失败，请稍后重试。", snapshot);
          }
        });
    }
    return {
      title: snapshot?.share_copy || "测测你是哪种校园人设？",
      path: "/pages/index/index"
    };
  }
});
