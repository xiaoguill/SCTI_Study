# 校园人设测试 · 三版本 V5.0

这是高中版、大学版和硕博版共用的校园人设后端、题库构建与测试工程。三个版本共享版本注册表、构建器、判定引擎和云函数协议；浏览器验收入口位于 `frontend-demo`，原生微信小程序客户端位于 `miniprogram`。

## 数据源与生成产物

运行时配置只有三类权威来源：

- 根目录 `data/banks/*.json`：各身份版本的完整私有题库；
- 根目录 `data/quiz-versions.v1.json`：启用版本、题库版本、主题、文案和公开文件名；
- 根目录 `data/algorithms/*.json`：私有算法 profile。

`campus_persona/data/`、`campus_persona/cloudfunctions/*/data/`、`frontend-demo/data/` 和 `miniprogram/data/runtime.js` 都由统一构建命令生成，绝不能手工编辑。`get-bank`、`frontend-demo` 与原生客户端只接收不含 `scores`、`core_questions` 和私有算法参数的公开题库；`submit-quiz` 才携带私有题库与算法配置。

`submit-quiz` 内部可保留排序分数与标签目标向量用于判定，但写入 `quiz_records.result` 和返回客户端前必须经过同一个公开结果 DTO。公开结果不包含 `scores_ranking` 或 `dimensions.target_vector`；浏览器本地模式复用同一 DTO，不能另行扩展可逆推出评分的字段。

`npm run build:bank` 继续作为兼容命令并转调 `npm run build:banks`；日常维护统一使用后者。

## 一次维护、全目标同步

每次内容或配置变更都按以下命令执行：

```powershell
cd E:\SCTI_Study
node scripts/validate-question-banks.mjs
cd campus_persona
npm run build:banks
npm test
cd ..\frontend-demo
npm test
npm start
```

### 更新题目或结果文案

只修改对应的 `data/banks/<version>.v<bank_version>.json`，先校验，再构建并运行两组测试。Markdown 是需求追溯材料，不与规范 JSON 共同承担运行时事实源；生成目录中的 JSON 不接受反向手改。

需要从现有 Markdown 重新编译时，`npm run compile:banks` 会先在内存中完成三版编译，并校验每个题库及其引用的算法 profile，全部通过后才写入规范数据。导入编译模块不会写文件；测试和预检应调用 `compileQuestionBanks({ write: false })`。

### 调整算法参数

在 `data/algorithms/` 新建一个有新版本号的 profile，更新目标题库的 `algorithm_profile` 引用，并补充或更新算法黄金样本。不要覆盖旧 profile，以免旧题库的判定含义漂移。

### 新增身份版本

新增一份符合统一 Schema 的规范题库，并在 `data/quiz-versions.v1.json` 增加版本条目、`tag_prefix`、主题、文案和公开文件名；如需新算法，再增加 profile。`tag_prefix` 必须为安全的大写前缀，题库全部标签 ID、选项评分引用和标签自身的 `prefix` 元数据必须一致。`public_bank_file` 固定遵循 `<id>.v<bank_version>.public.json`。符合现有协议的常规内容、算法参数和版本配置变更不需要修改前端或构建器业务代码。

## 本地浏览器验收

```powershell
cd E:\SCTI_Study\frontend-demo
npm start
```

打开 `http://127.0.0.1:4175`。浏览器环境没有 `wx.cloud` 时使用与云端同一判定模块的本地服务。

## 原生微信小程序验收

`miniprogram/` 包含 `app.json`、WXML、WXSS 和三版本单页流程。`cloudEnvId` 为空时读取内置公开题库，并调用上述本地结果服务；填写 CloudBase 环境 ID 后只调用云函数。导入开发者工具、项目配置和本地/云端切换步骤见 [原生客户端说明](../miniprogram/README.md)。

## CloudBase 与隐私边界

仓库已准备 `get-bank`、`submit-quiz`、`user-login` 和 `record-share` 四个后端函数；部署前提和顺序见 [微信 CloudBase 部署交接](docs/wechat-cloud-deployment.md)。当前仓库交付不代表已部署。

`OPENID_HMAC_SECRET` 只能配置在云函数环境中。不要提交或打印 AppID、环境 ID、密钥、openid、身份哈希、完整答案或带凭据的端点。此交接不需要 AppSecret。
