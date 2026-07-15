# 微信 CloudBase 部署交接

## 当前交付状态

本仓库已准备三版本共用的后端函数、规范数据、构建器和自动测试，但本次没有绑定任何真实 AppID 或 CloudBase 环境，也没有上传、部署或发布。以下内容是交接清单，不是部署完成声明。

Repository-ready backend functions: get-bank, submit-quiz, user-login, record-share
User prerequisites: registered/authorized AppID, DevTools QR login, CloudBase environment, certification/service category/billing/release approval, OPENID_HMAC_SECRET only in cloud function env
Collections: users, quiz_records, share_records
Indexes:
  users: provider_subject_hash + platform
  quiz_records: user_id + version + created_at
  quiz_records: version + result.tag_id
Sequence: validation/build/tests; bind env; upload/deploy each with cloud-side dependency install; verify get-bank all 3; authenticated submit-quiz; sanitized logs; upload native client dev version.

## 用户侧前提

- 已注册且授权当前项目使用的微信小程序 AppID；
- 在微信开发者工具中完成扫码登录；
- 已创建并明确选择要绑定的 CloudBase 环境；
- 已处理账号认证、服务类目、计费、审核和发布权限；
- 只在云函数环境变量中配置 `OPENID_HMAC_SECRET`，不写入仓库、客户端、构建日志或聊天记录。

本次后端代码交接不需要 AppSecret。不要提供或提交真实 AppID、环境 ID、AppSecret、密钥、用户标识或带凭据端点。

## 数据库准备

创建以下集合：

- `users`
- `quiz_records`
- `share_records`

创建以下复合索引：

- `users`：`provider_subject_hash + platform`
- `quiz_records`：`user_id + version + created_at`
- `quiz_records`：`version + result.tag_id`

索引字段顺序应按实际查询计划在 CloudBase 控制台复核。部署验证不得向日志输出 openid、身份哈希、密钥、token 或完整答案。

## 部署前验证

从仓库根目录运行唯一维护流程：

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

根目录 `data/banks/*.json`、`data/quiz-versions.v1.json` 和 `data/algorithms/*.json` 是权威输入。注册表中的每个版本都必须声明与题库标签一致的 `tag_prefix`；构建出的部署 JSON 不得手工修改。Markdown 编译器先在内存中校验全部生成题库和引用 profile，失败时不得写入任何规范题库；部署预检使用 `compileQuestionBanks({ write: false })`，不要为了预检覆盖规范数据。

## CloudBase 部署顺序

1. 完成校验、统一构建和全部自动测试，确认三个公开题库均无私有评分字段。
2. 在微信开发者工具中绑定用户选定的 CloudBase 环境；不要把环境 ID 写入版本库。
3. 在该环境中配置 `OPENID_HMAC_SECRET`，并确认它只对云函数可见。
4. 逐个上传并部署 `get-bank`、`submit-quiz`、`user-login`、`record-share`，每个函数选择云端安装依赖。
5. 调用 `get-bank` 的版本注册表接口，并分别验证 `high_school`、`university`、`graduate` 三个公开题库。
6. 通过真实登录上下文执行一次认证后的 `submit-quiz`，确认版本、题库版本、结果协议和数据库写入正确；API 的 `server_result` 与 `quiz_records.result` 均不得包含 `scores_ranking` 或 `dimensions.target_vector`，且必须保留结果页所需文案、四维用户向量、距离、彩蛋和 Q20 自我认知。
7. 检查清洗后的云函数日志，确认没有 openid、身份哈希、密钥、token、完整答案或带凭据端点。
8. 后端验证通过后，再上传原生小程序客户端开发版本。

## 已知生产边界

`frontend-demo` 仍是浏览器验收客户端，不能作为小程序上传；仓库现已提供 `miniprogram/` 原生 WXML/WXSS 客户端。原生客户端本地模式只用于微信开发者工具，填写 `miniprogram/config/runtime.js` 的 `cloudEnvId` 后才进入 CloudBase 模式。

当前仍未执行真实云函数部署、真机/体验版测试、审核材料准备、审核提交或正式发布。完成云端验证后，才能把 `miniprogram/` 上传为开发版本并继续体验版与审核流程。

用户完成微信开发者工具登录并选择 CloudBase 环境后，我可以继续协助上传和部署这四个 repository-ready backend functions，并按上述顺序验证；在这些用户前提完成之前，不应声称部署已经发生。
