# 校园人设测试 V5.0 三版本规格

本文用三版本实现替代旧的 university-only MVP 冻结说明。详细架构、协议和验收标准以 [配置驱动的三版本校园人设测试设计](../../docs/superpowers/specs/2026-07-13-config-driven-three-version-campus-persona-design.md) 为准。

## 1. 范围

- 身份版本：`high_school`、`university`、`graduate`，均由版本注册表启用；
- 每版 20 题、16 个标签；Q1-Q19 每题 4 个选项，Q20 为 16 个直觉自我认知选项；
- 三版共享页面、状态层、提交协议、判定引擎与 CloudBase 云函数；
- 题库、主题、展示文案、结果、分享文案和算法参数均由配置驱动；
- 浏览器验收客户端已覆盖三版；原生微信客户端适配与发布仍属于单独生产阶段；
- QQ 端、历史记录页、统计看板、题库管理端和服务端海报渲染不在本轮范围。

## 2. 权威数据与构建边界

根目录 `data/banks/*.json`、`data/quiz-versions.v1.json` 和 `data/algorithms/*.json` 是运行配置的唯一权威来源。Markdown 只用于需求追溯；所有前端、`get-bank` 与 `submit-quiz` 部署 JSON 均由 `npm run build:banks` 生成，不得手工编辑。

正常更新题目/文案、算法 profile 或新增版本时，只修改规范数据并重新校验、构建、测试，不需要修改前端业务代码。

## 3. 结果影响与算法归属

每道题必须显式声明 `result_effect`。统一算法 profile 区分：

- `scored`：可参与主标签和四维计算；
- `egg_only`：只收集彩蛋；
- `self_perception_only`：只返回直觉自我认知。

Q20 固定为 `self_perception_only`，不参与核心命中、累计分或四维向量。固定 Q1-Q19 后遍历 Q20 的 16 个选项，主标签与四维结果必须保持不变。

最终结果以 `submit-quiz` 服务端算法为准。浏览器本地模式复用同一个算法模块，仅用于验收；公开前端不接收 `scores`、`core_questions`、标签目标向量或私有阈值。

## 4. 身份索引与隐私

不保存原始 openid。云函数使用只存在于云函数环境中的 `OPENID_HMAC_SECRET`，对 `platform + provider_subject` 做 HMAC-SHA256，数据库只保存：

```text
provider_subject_hash + platform
```

日志禁止输出 openid、provider_subject_hash、token、密钥和完整答题数据。仓库不得包含 AppID、CloudBase 环境 ID、AppSecret、用户身份或带凭据的端点。

## 5. 前端与平台边界

`get-bank` 按版本返回题干、选项文本、题型、`result_effect` 和展示配置；`submit-quiz` 按同一版本加载私有题库与算法 profile。未知、关闭或题库版本不匹配的请求返回明确错误，不回退到大学版。

`frontend-demo` 是 browser acceptance client，不能作为小程序上传；`miniprogram/` 是原生 WXML/WXSS 客户端。本地模式只用于微信开发者工具，真机与体验版必须切换 CloudBase。真实云部署、体验版测试、审核提交和正式发布仍属于后续生产步骤；此代码交接不需要 AppSecret。

## 6. 分享与发布边界

分享路径中的版本必须动态使用当前身份：

```text
/pages/result/index?tag={tagId}&v={version}
```

`record-share` 只记录经清洗的分享事件。海报、云存储图片和小程序码不伪造完成状态。

真实发布前仍需用户提供或完成已授权 AppID、微信开发者工具扫码登录、CloudBase 环境选择、账号认证/服务类目/计费/审核权限、数据库集合与索引，以及云函数环境变量。部署步骤见 [微信 CloudBase 部署交接](wechat-cloud-deployment.md)。
