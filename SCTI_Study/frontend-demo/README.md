# 校园人设测试 · 三版本浏览器验收客户端

`frontend-demo` 用原生 HTML、CSS 和 JavaScript 模拟手机画布，验证高中版、大学版、硕博版共用的选身份、欢迎、答题、分析、结果与分享流程。身份卡、主题、题库路径和版本文案都来自生成的版本注册表，不在前端业务代码中维护版本分支。

## 本地运行

```powershell
cd E:\SCTI_Study\frontend-demo
npm start
```

然后打开 <http://localhost:4173>。浏览器环境没有 `wx.cloud` 时会调用本地结果服务；它复用 `submit-quiz` 的判定模块与统一结果协议。

## 数据与维护边界

`data/runtime-registry.json` 和 `data/*.public.json` 都是从根目录的 `data/quiz-versions.v1.json`、`data/banks/*.json` 与 `data/algorithms/*.json` 构建出的公开产物，绝不能手工编辑。公开产物不包含评分权重、核心题映射或私有算法阈值。

正常的题目/文案更新、算法 profile 调整和身份版本新增只修改根目录规范数据，随后运行 `campus_persona` 的 `npm run build:banks`；不需要修改前端业务代码。完整命令见 [后端与题库 README](../campus_persona/README.md)。

## 生产边界

这是 browser acceptance client，NOT native WXML/WXSS。原生小程序适配、真机/体验版测试、平台审核和正式发布是单独的生产阶段。真实微信运行时可以调用 `get-bank`、`user-login`、`submit-quiz` 与 `record-share`，但当前浏览器交付不表示 CloudBase 已部署，也不表示原生客户端已经上传。

本次代码交接不需要 AppSecret。任何 AppID、CloudBase 环境 ID、密钥、用户身份或带凭据端点都不得写入仓库或日志。
