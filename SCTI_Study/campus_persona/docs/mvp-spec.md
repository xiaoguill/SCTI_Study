# 校园人设测试 V5.0 MVP 规格冻结

本文是本轮开发的执行规格，优先级高于原 PRD 中未明确的描述。当前 MVP 只实现大学版微信小程序流程；高中版、硕博版、QQ 端、历史记录页和管理后台留到后续版本。

## 1. 范围

- 版本：`university` / `V5.0.1`
- 题目：20 题；Q1-Q19 每题 4 个选项；Q20 16 个选项
- 标签：U1-U16 共 16 个
- 平台：微信小程序
- 后端：微信云开发云函数 + 文档数据库
- 本轮交付：欢迎页、大学版答题、后端三层算法、结果页、基础转发分享、分享记录
- 本轮不交付：高中/硕博题库、QQ 端、服务端海报渲染、历史记录、统计看板、题库管理端

## 2. 冲突解决

### 2.1 题库阶段

原 PRD 同时把三套题库列为 P0，又把 V5.0/V5.1/V5.2 作为阶段规划。本轮按阶段规划执行：V5.0 只启用大学版。所有接口强制接收 `version=university`，其他版本返回 `404`。

### 2.2 结果影响字段

每道题都必须显式声明 `result_effect`：

```json
{ "result_effect": "scored" }
```

或：

```json
{ "result_effect": "egg_only" }
```

本版规则：Q5、Q8、Q12、Q19 为 `egg_only`；Q16 虽然属于节奏破坏题，但保留文档中的权重，标记为 `scored`。算法只累加 `scored` 题的 `scores`。

### 2.3 算法归属

最终结果以服务端为准。前端只负责拉取不含 `scores` 的题库、答题进度、本地恢复和分析动画；前端不会计算最终结果，也不会接收服务端完整权重。

`submit-quiz` 云函数执行：

1. 核心定选题精确匹配，命中即返回 `match_method=core`。
2. 对 `result_effect=scored` 的题目做得分累积，最高分与次高分相差至少 3 分时返回 `match_method=score`。
3. 否则根据四维度用户向量与标签目标向量的曼哈顿距离兜底，返回 `match_method=dimension`。

题库原文没有为每个选项提供完整四维度向量。本 MVP 使用“选项权重对应标签目标向量的加权平均”生成并固化 `options[].dimensions`；无权重的彩蛋题使用 `[3,3,3,3]`。这是一条透明的 MVP 补全规则，正式上线前应由产品重新校准。

### 2.4 身份索引与隐私

不保存原始 openid。云函数使用环境变量 `OPENID_HMAC_SECRET` 对 `platform + provider_subject` 做 HMAC-SHA256，数据库只保存：

```text
provider_subject_hash + platform
```

日志禁止输出 openid、provider_subject_hash、token 和完整答题数据。

## 3. 前端数据边界

`get-bank` 返回：题干、选项文本、题型、`result_effect`、彩蛋映射和展示用标签文案；不返回 `scores`。服务端私有题库只存放在 `submit-quiz` 云函数包内。

浏览器版 `frontend-demo` 在没有 `wx.cloud` 时使用本地演示回包，仅用于验收页面规格；进入真实微信小程序后由 `wx.cloud.callFunction` 调用云函数。

## 4. 分享边界

本轮实现 `onShareAppMessage` / `onShareTimeline` 所需的结果路径和 `record-share` 云函数。海报生成、云存储图片和小程序码先保留接口位置，不在 MVP 阶段伪造已完成状态。

分享路径：

```text
/pages/result/index?tag={tagId}&v=university
```

## 5. 发布前阻塞项

以下信息需要在真实部署前补齐，不写入仓库：微信 AppID、CloudBase 环境 ID、`OPENID_HMAC_SECRET`、云数据库索引、云函数部署权限和小程序码素材。
