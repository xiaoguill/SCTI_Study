# 校园人设测试 · 微信小程序风格 Demo

这是 V5.0 MVP 的前端规格验收 Demo，用浏览器模拟微信小程序的手机画布。当前只开放大学版，题库从 `data/university-bank.public.json` 加载；在真实微信小程序运行时，前端会优先调用 CloudBase 云函数。

它包含：

- 欢迎页：产品入口、插画占位、测试信息
- 身份选择页：大学生（高中版、硕博版留待后续版本）
- 答题页：进度条、选项选中态、自动切题、返回上一题
- 结果页：人设主卡片、四维度可视化、关键词、分享卡片弹层

## 本地运行

在 `frontend-demo` 目录执行：

```powershell
npm start
```

然后打开 <http://localhost:4173>。

## 说明

当前 demo 使用纯 HTML / CSS / JavaScript，便于先确认页面规格和交互节奏。浏览器环境会使用明确标注的本地演示回包；微信小程序环境通过 `frontend-demo/api/cloud.js` 调用 `get-bank`、`user-login`、`submit-quiz` 和 `record-share` 云函数。

三层算法、私有权重和最终结果在 `campus_persona/cloudfunctions/submit-quiz/` 维护，浏览器只拿公开题目和结果文案，不接收评分权重。
