# 原生微信小程序三版本客户端设计

## 1. 目标

在现有配置驱动的高中版、大学版、硕博版题库和后端基础上，新增一个可由微信开发者工具直接编译的原生小程序客户端。

完成后应满足：

- 微信开发者工具打开 `E:\SCTI_Study` 后能够找到合法的 `app.json` 和页面；
- 身份页同时显示高中生、大学生、硕博生三个入口；
- 三个版本均可完成 20 题、查看结果、查看 Q20 自我认知和分享；
- 未配置 CloudBase 时，可以在开发者工具中使用本地公开题库和本地结果服务完成测试；
- 配置 CloudBase 环境 ID 后，客户端自动改用云函数；
- 私有权重、核心题映射、标签目标向量和完整评分排名不进入小程序包或客户端返回；
- 日常修改题库、算法配置或版本注册表时，不在原生页面中重复维护题目和版本文案。

## 2. 项目目录与开发者工具配置

新增原生客户端目录：

```text
miniprogram/
  app.js
  app.json
  app.wxss
  sitemap.json
  config/runtime.js
  data/runtime.js
  pages/index/
    index.js
    index.json
    index.wxml
    index.wxss
  services/quiz-service.js
  utils/answer-state.js
  utils/result-model.js
  utils/version-context.js
```

根目录 `project.config.json` 保留用户现有 AppID，并增加：

```json
{
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "campus_persona/cloudfunctions/"
}
```

`F:\wechat_devtools` 仅是微信开发者工具安装目录，不保存项目业务代码。项目源码、生成数据和云函数均保存在 `E:\SCTI_Study`。

## 3. 数据来源与构建

继续使用以下文件作为唯一权威输入：

- `data/quiz-versions.v1.json`：版本入口、显示文案、主题和题库版本；
- `data/banks/*.json`：三套私有规范题库；
- `data/algorithms/*.json`：后端算法配置。

扩展 `campus_persona/scripts/build-question-banks.mjs`，在已有浏览器和云函数产物之外生成：

```text
miniprogram/data/runtime.js
```

该文件以 CommonJS 模块形式导出公开版本注册表和三套公开题库。生成器必须复用 `createPublicBank`，确保不包含：

- `tags`；
- `scores`；
- `core_questions`；
- `algorithm_profile`；
- 标签目标向量和完整评分排名。

原生页面不得硬编码具体题目、标签或版本专属结果文案。生成文件不得手工修改。

## 4. 本地与云端运行模式

`miniprogram/config/runtime.js` 提供一个非敏感配置：

```js
module.exports = {
  cloudEnvId: "",
  localResultEndpoint: "http://127.0.0.1:4175/api/submit-quiz"
};
```

模式判定：

- `cloudEnvId` 为空：本地模式；
- `cloudEnvId` 非空：云端模式。

本地模式：

1. 从 `miniprogram/data/runtime.js` 读取版本注册表和公开题库；
2. 使用 `wx.request` 调用本机结果接口；
3. 本机运行 `frontend-demo/npm start`，由现有共享算法计算并返回脱敏结果；
4. 本地服务不可用、超时或返回异常时，恢复到答题页并显示可重试中文错误，不停留在“正在生成结果”。

云端模式：

1. `app.js` 使用用户填写的环境 ID 初始化 `wx.cloud`；
2. 通过 `get-bank` 获取版本注册表和指定公开题库；
3. 通过 `submit-quiz` 计算结果；
4. 通过 `record-share` 记录分享；
5. 云函数失败时显示可恢复错误，不自动回退到 localhost，避免线上环境误连本机。

本地模式仅保证微信开发者工具中的电脑端调试。真机、体验版、审核版和正式版必须使用 CloudBase。

## 5. 页面与交互

首期使用一个原生页面和显式状态机，保持浏览器验收版的奶油纸张、马卡龙主题色、粗黑描边和手绘卡片风格。

页面状态：

1. `welcome`：欢迎页；
2. `identity`：由注册表动态渲染三个身份卡；
3. `loading`：加载题库；
4. `quiz`：动态渲染当前题目和选项；
5. `analysis`：提交后的短暂计算状态；
6. `result`：结果、三段文案、四维度、自我认知、彩蛋和分享。

答题规则：

- Q1-Q19 每题四个选项；
- Q20 十六个选项，并明确显示“不参与主标签和四维计算”；
- 各版本进度按 `cache_namespace + bank_version` 独立缓存；
- 题库版本不匹配时丢弃旧进度；
- 快速切换版本或重复提交时，旧异步结果不得覆盖当前页面；
- 结果协议不完整时不渲染半成品结果页。

分享使用原生 `onShareAppMessage`，分享标题优先使用结果中的 `share_copy`。本地模式的分享记录可跳过；云端模式调用 `record-share`。

## 6. 安全边界

- 小程序包只包含公开题库；
- 评分算法、权重、核心题、目标向量和完整标签排名保留在本地 Node 服务或 CloudBase 云函数；
- `cloudEnvId` 不是密钥，可以由用户在本地配置，但不得提交 AppSecret；
- `OPENID_HMAC_SECRET` 只配置在 CloudBase 云函数环境变量；
- 不在日志中输出 openid、密钥、token、完整答案或私有评分数据；
- 不覆盖或提交用户现有 `project.private.config.json`。

## 7. 错误处理

- 找不到版本：提示“该测试版本暂不可用”并返回身份页；
- 本地服务未启动：提示运行 `frontend-demo` 的 `npm start`；
- 请求超时：中止请求并允许重新生成；
- 题库版本过期：清除该版本缓存并重新加载；
- 答案结构错误：定位第一道未完成或异常题目；
- 云端身份配置缺失：提示检查 CloudBase 环境，不显示内部错误；
- 分享失败：保留结果页并提供分享文案，不产生未处理 Promise。

## 8. 测试与验收

自动验证：

- 原生数据产物只包含公开字段；
- 三个版本都进入生成产物；
- 版本选择、缓存键、答案恢复和结果协议使用纯函数测试；
- 本地/云端模式选择正确；
- 缺少版本不隐式回退大学版；
- Q20 的 48 种选择仍不改变主标签和用户四维；
- 现有根题库、后端和浏览器测试继续通过。

开发者工具手工验收：

- 项目根目录不再出现“找不到 app.json”；
- 身份页可见高中、大学、硕博三个入口；
- 三个版本分别完成 20 题并生成结果；
- Q20 显示十六选项和独立说明；
- 结果页、重新测试、返回、分享均可用；
- 未启动本地服务时错误可恢复；
- 填入测试 CloudBase 环境 ID 后，客户端请求切换为云函数。

## 9. 交付边界

本阶段交付原生客户端、本地开发模式、CloudBase 接口切换和开发者工具编译验收。真实云函数上传、数据库集合与索引创建、环境变量配置、体验版上传、审核和正式发布由用户在相应账号权限下操作；后续可按部署文档逐步协助。
