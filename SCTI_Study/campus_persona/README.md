# 校园人设测试 · V5.0 MVP

这是独立于当前 Python RAG 工程的大学版 MVP 后端与题库工程。前端验收入口继续使用仓库根目录下的 `frontend-demo`。

## 本地预览

```powershell
cd E:\SCTI_Study\frontend-demo
npm start
```

打开 `http://localhost:4173`。浏览器环境没有 `wx.cloud`，页面会显示本地演示回包；真实微信小程序运行时替换为 CloudBase 云函数。

## 目录

```text
campus_persona/
├── data/                         # 大学版服务端题库源数据
├── cloudfunctions/
│   ├── get-bank/                 # 返回去权重题库
│   ├── submit-quiz/              # 三层算法 + 记录写入
│   ├── user-login/               # HMAC 身份索引
│   └── record-share/             # 基础分享记录
├── docs/mvp-spec.md              # 本轮冻结规格
├── scripts/build-university-bank.mjs
└── tests/                        # 算法和题库测试
```

## 重新生成题库产物

题库权威来源在工作区根目录的 `data/banks/*.v5.0.0.json`。先从三份 Markdown 规格编译，再校验三套题库，最后生成大学版的私有和公开部署产物：

```powershell
node ../scripts/compile-question-banks.mjs
npm run validate:banks
npm run build:bank
```

`get-bank` 和 `frontend-demo` 只使用不含 `scores` 与 `core_questions` 的公开题库；`submit-quiz` 使用私有题库。

题库源定义位于 `scripts/build-university-bank.mjs`，执行：

```powershell
cd E:\SCTI_Study\campus_persona
node scripts/build-university-bank.mjs
```

它会生成服务端私有题库、`get-bank` 公共题库和浏览器 Demo 使用的公共题库。生成结果不包含任何密钥。

## CloudBase 部署前配置

需要在云函数环境中设置：

```text
OPENID_HMAC_SECRET=<只在 CloudBase 环境变量中设置>
```

不要把真实 AppID、环境 ID、密钥或用户身份写入 `.env` 以外的版本文件，也不要打印到日志。
