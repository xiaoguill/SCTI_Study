const { hasCompleteResult } = require("../../utils/result-model");
const { enabledVersions, findVersion } = require("../../utils/version-context");

function createPageState(registry) {
  return {
    registry,
    versions: enabledVersions(registry),
    screen: "welcome",
    activeVersion: null,
    bank: null,
    questionIndex: 0,
    navigationMode: "auto",
    answers: {},
    result: null,
    error: null,
    submitting: false,
    generation: 0
  };
}

function beginVersion(state, versionId) {
  const activeVersion = findVersion(state.registry, versionId);
  return {
    ...state,
    screen: "loading",
    activeVersion,
    bank: null,
    questionIndex: 0,
    navigationMode: "auto",
    answers: {},
    result: null,
    error: null,
    submitting: false,
    generation: state.generation + 1
  };
}

function currentOperation(state) {
  return {
    generation: state.generation,
    version: state.activeVersion?.id || "",
    bankVersion: state.activeVersion?.bank_version || ""
  };
}

function isCurrentOperation(state, operation) {
  const current = currentOperation(state);
  return Boolean(
    operation
    && current.generation === operation.generation
    && current.version === operation.version
    && current.bankVersion === operation.bankVersion
  );
}

function acceptLoadedBank(state, bank, operation) {
  if (!isCurrentOperation(state, operation)) return state;
  if (bank?.version !== operation.version || bank?.bank_version !== operation.bankVersion) {
    throw new Error("题库版本不匹配，请重新选择测试版本");
  }
  return { ...state, bank, screen: "quiz", error: null };
}

function questionModel(state) {
  const question = state.bank?.questions?.[state.questionIndex];
  if (!question) throw new Error("当前题目不存在");
  return {
    question,
    optionCount: question.options.length,
    selfPerceptionOnly: question.result_effect === "self_perception_only"
  };
}

function selectAnswer(state, selected) {
  const { question } = questionModel(state);
  if (!Number.isInteger(selected) || selected < 0 || selected >= question.options.length) {
    throw new Error("答案选项无效");
  }
  return {
    ...state,
    answers: { ...state.answers, [question.id]: selected },
    error: null
  };
}

function selectionNavigation(state, answeredIndex, wasAnswered) {
  if (state.screen !== "quiz" || state.questionIndex !== answeredIndex) return "stay";
  if (state.navigationMode !== "auto" || wasAnswered) return "stay";
  return answeredIndex === state.bank.questions.length - 1 ? "submit" : "advance";
}

function previousQuestionState(state) {
  if (state.questionIndex <= 0) return state;
  return { ...state, questionIndex: state.questionIndex - 1, navigationMode: "review", error: null };
}

function nextQuestionState(state) {
  const question = state.bank.questions[state.questionIndex];
  if (!Number.isInteger(state.answers[question.id])) {
    const error = new Error(`第${state.questionIndex + 1}题尚未完成`);
    error.questionIndex = state.questionIndex;
    throw error;
  }
  if (state.questionIndex >= state.bank.questions.length - 1) return state;
  const nextIndex = state.questionIndex + 1;
  const nextQuestion = state.bank.questions[nextIndex];
  const nextAnswered = Number.isInteger(state.answers[nextQuestion.id]);
  return {
    ...state,
    questionIndex: nextIndex,
    navigationMode: nextAnswered ? "review" : "auto",
    error: null
  };
}

function acceptResult(state, result, operation) {
  if (!isCurrentOperation(state, operation)) return state;
  if (!hasCompleteResult(result) || result.version !== operation.version || result.bank_version !== operation.bankVersion) {
    throw new Error("结果数据不完整，请重新生成");
  }
  return { ...state, result, screen: "result", error: null, submitting: false };
}

function recoverSubmitError(state, message, operation) {
  if (!isCurrentOperation(state, operation)) return state;
  return {
    ...state,
    screen: "quiz",
    result: null,
    error: message || "结果计算失败，请重新生成结果",
    submitting: false
  };
}

function recoverLoadError(state, message, operation) {
  if (!isCurrentOperation(state, operation)) return state;
  return {
    ...state,
    screen: "identity",
    bank: null,
    error: message || "题库加载失败",
    submitting: false
  };
}

module.exports = {
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
};
