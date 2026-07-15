import { enabledVersions } from "./version-context.mjs";

export function identityCardModels(registry, selectedVersionId) {
  return enabledVersions(registry).map((version) => ({
    ...version,
    selected: version.id === selectedVersionId
  }));
}

export function questionHint(question) {
  if (question.result_effect === "egg_only") {
    return "这一题不影响主标签，答案会成为你的结果彩蛋。";
  }
  if (question.result_effect === "self_perception_only") {
    return "这一题用于记录你的直觉自我认知，不参与主标签和四维计算。";
  }
  return "先别想太久，第一反应往往最像你。";
}

export function isCurrentOperation(snapshot, current) {
  return Boolean(
    snapshot
    && current
    && snapshot.token === current.token
    && snapshot.version === current.version
    && snapshot.bankVersion === current.bankVersion
    && snapshot.progressKey === current.progressKey
  );
}

export async function attemptNativeShare(share, payload) {
  if (typeof share !== "function") return false;
  try {
    await share(payload);
    return true;
  } catch {
    return false;
  }
}

const staleShareOutcome = () => ({ status: "stale", showModal: false, feedback: "" });

export async function orchestrateShare({
  operation,
  isCurrent,
  recordShare,
  recordPayload,
  nativeShare,
  sharePayload
}) {
  if (!isCurrent(operation)) return staleShareOutcome();

  let recordFailed = false;
  try {
    const response = await recordShare(recordPayload);
    if (!isCurrent(operation)) return staleShareOutcome();
    recordFailed = response?.code !== 0;
  } catch {
    if (!isCurrent(operation)) return staleShareOutcome();
    recordFailed = true;
  }

  const shared = await attemptNativeShare(nativeShare, sharePayload);
  if (!isCurrent(operation)) return staleShareOutcome();

  if (recordFailed) {
    return {
      status: "record_failed",
      showModal: true,
      feedback: "分享记录暂时失败，仍可使用分享卡片。"
    };
  }
  if (!shared) {
    return {
      status: "fallback",
      showModal: true,
      feedback: "系统分享未完成，可使用下方分享卡片。"
    };
  }
  return { status: "shared", showModal: false, feedback: "" };
}

const isNonemptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isDimensionValue = (value) => Number.isFinite(value) && value >= 1 && value <= 5;

export function hasCompleteResult(result) {
  const descriptions = result?.tag_full_desc;
  const dimensions = result?.dimensions;
  const selfPerception = result?.self_perception;
  const descriptionFields = ["paragraph_1", "paragraph_2", "paragraph_3"];
  return Boolean(
    result
    && isNonemptyString(result.tag_id)
    && isNonemptyString(result.tag_name)
    && isNonemptyString(result.tag_short_desc)
    && descriptions && typeof descriptions === "object"
    && descriptionFields.every((field) => isNonemptyString(descriptions[field]))
    && Array.isArray(result.keywords) && result.keywords.length > 0
    && result.keywords.every((keyword) => isNonemptyString(keyword))
    && isNonemptyString(result.share_copy)
    && dimensions
    && Array.isArray(dimensions.labels) && dimensions.labels.length === 4
    && dimensions.labels.every((label) => isNonemptyString(label))
    && Array.isArray(dimensions.user_vector) && dimensions.user_vector.length === 4
    && dimensions.user_vector.every((value) => isDimensionValue(value))
    && Array.isArray(result.easter_eggs)
    && result.easter_eggs.every((egg) => Number.isInteger(egg?.qid) && isNonemptyString(egg?.value))
    && selfPerception
    && selfPerception.qid === 20
    && typeof selfPerception.option_id === "string"
    && /^[A-P]$/.test(selfPerception.option_id)
    && isNonemptyString(selfPerception.text)
  );
}
