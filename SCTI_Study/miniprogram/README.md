# 原生微信小程序客户端

`miniprogram/` 是可由微信开发者工具直接编译的原生客户端。它复用统一生成的三版本公开题库，不包含私有评分权重、核心题、目标向量或完整标签排名。

## 本地开发模式

默认 `config/runtime.js` 中 `cloudEnvId` 为空，因此客户端读取 `data/runtime.js` 并请求本机结果服务。

先运行完整检查和本地服务：

```powershell
cd E:\SCTI_Study
node scripts\validate-question-banks.mjs
node scripts\validate-mini-program.mjs
cd campus_persona
npm.cmd run build:banks
npm.cmd test
cd ..\frontend-demo
npm.cmd test
npm.cmd start
```

本地服务地址固定为 `http://127.0.0.1:4175/api/submit-quiz`。随后在微信开发者工具中导入或重新编译 `E:\SCTI_Study`。

如果开发者工具阻止 localhost 请求，可在“详情 → 本地设置”中仅为本地调试勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。该设置不能代替真机、体验版或发布前的合法域名/CloudBase 验证。

## 切换 CloudBase

在 `config/runtime.js` 中填写：

```js
cloudEnvId: "你的 CloudBase 环境 ID"
```

非空后客户端只调用 `get-bank`、`submit-quiz`、`record-share` 云函数，不会回退 localhost。上传前需要先部署仓库中的四个云函数并准备数据库集合、索引和云函数环境变量；参见 `campus_persona/docs/wechat-cloud-deployment.md`。

不要在客户端或仓库中填写 AppSecret、`OPENID_HMAC_SECRET`、openid 或其他凭据。

## 更新题库

只修改根目录 `data/` 下的规范题库、版本注册表或算法 profile，然后运行：

```powershell
cd E:\SCTI_Study\campus_persona
npm.cmd run build:banks
```

该命令会重新生成 `miniprogram/data/runtime.js`。生成文件不得手工编辑。
