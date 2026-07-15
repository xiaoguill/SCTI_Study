# 三版本校园人设 Task 8 Builder 报告

日期：2026-07-13

分支：`agent/three-version-campus-persona`

起始 HEAD：`312e1e9333cd4b0c37b78aac79900676326e58c4`

## 交付摘要

Task 8 清除了 university-only 重复数据路径，把大学版编译输入切换到根目录规范题库，保留 `npm run build:bank` 到 `npm run build:banks` 的兼容别名，并补齐三版本的一源维护、浏览器验收边界和 CloudBase 部署交接。统一构建不会重新生成已删除的旧文件。

## 文件清单

### Modified

- `campus_persona/README.md`
- `campus_persona/docs/mvp-spec.md`
- `frontend-demo/README.md`
- `frontend-demo/tests/answer-state.test.mjs`
- `scripts/compile-question-banks.mjs`
- `tests/question-banks.test.js`

### Created

- `.gitignore`
- `campus_persona/docs/wechat-cloud-deployment.md`
- `docs/superpowers/plans/2026-07-13-config-driven-three-version-campus-persona.md`
- `docs/superpowers/reports/three-version-campus-persona-builder.md`
- `docs/superpowers/specs/2026-07-13-config-driven-three-version-campus-persona-design.md`

`.gitignore`、设计和计划文件已与 `E:\SCTI_Study` 中批准的对应文件逐字节比对，SHA-256 相同。

### Deleted

- `campus_persona/data/university-bank.json`
- `campus_persona/cloudfunctions/get-bank/university-bank.public.json`
- `campus_persona/cloudfunctions/submit-quiz/university-bank.json`
- `frontend-demo/data/university-bank.public.json`
- `campus_persona/scripts/build-university-bank.mjs`

## RED / GREEN

RED：新增清理回归测试后运行 `node --test tests/question-banks.test.js`，共 5 项：4 passed、1 failed。失败消息一次列出上述 5 个仍存在的旧路径，证明测试针对 stale university-only 数据路径生效。

GREEN：编译输入改为 `data/banks/university.v5.0.0.json`、前端测试改用 `data/university.v5.0.0.public.json` 并删除 5 个旧文件后，同一命令为 5 passed、0 failed。主动运行时扫描也返回 0 个 `university-bank` / `build-university-bank` 引用。

## 自动验证命令与实际计数

Windows PowerShell 的执行策略阻止了 `E:\npm.ps1`，因此所有 npm 命令实际使用等价的 `npm.cmd` 可执行文件；package script 与覆盖范围不变。

| 命令 | 实际结果 |
| --- | --- |
| `node scripts/validate-question-banks.mjs` | exit 0；university、high_school、graduate 三个题库各 20 questions / 16 tags |
| `node --test tests/question-banks.test.js` | 5 tests，5 passed，0 failed |
| `cd campus_persona; npm.cmd run build:banks` | exit 0；`Built 3 banks` |
| `cd campus_persona; npm.cmd test` | 19 tests，19 passed，0 failed |
| `cd frontend-demo; npm.cmd test` | 40 tests，40 passed，0 failed |
| `cd campus_persona; node --test --test-name-pattern="changing only Q20" tests/algorithm.test.js` | 3 tests，3 passed，0 failed |

## Q20 算法证据

聚焦测试分别覆盖 `high_school`、`university`、`graduate`。每个版本固定 Q1-Q19，先计算 Q20 option 0，再遍历 option 1-15；共覆盖 3 × 16 = 48 个 Q20 选项。每个变化都断言 `tag_id` 与 `dimensions.user_vector` 不变，同时断言 `self_perception.option_id` 跟随当前选项。聚焦运行结果为 3 passed、0 failed。

## 浏览器证据（父级已执行）

- viewport：`375x812`。
- identity screen：显示全部 3 个 enabled cards。
- high_school：完成 Q1-Q19，每题均显示 4 个选项；Q20 显示 16 个选项和明确的“不参与主标签”说明；结果渲染为“题海纺织工”；console 为 0 warn / 0 error。
- graduate：Q1 渲染硕博版专属场景与主题。
- university：Q1 保留大学版专属流程。

## 隐私、硬编码与公开产物扫描

- `OPENID_HMAC_SECRET` 非文档/非环境说明赋值扫描：0 matches；未输出任何密钥值。
- `frontend-demo` 与 `campus_persona/cloudfunctions` 主动运行时代码中的 university-only filename/routing/`#大学版` 扫描（排除 tests/docs）：0 matches。
- `frontend-demo/data` 与 `campus_persona/cloudfunctions/get-bank/data` 中的 `"scores"` / `"core_questions"` 扫描：0 matches。
- Git 变更路径保护扫描：0 个 `.env`、`memory_data`、`knowledge_base`、依赖、缓存、数据库或 credential/secret 文件；本报告加入后 Task 8 共 16 个变更路径。
- `npm.cmd run build:banks` 后生成产物无额外 diff，且没有重建 5 个旧路径。

历史迁移引用只保留在 `docs/superpowers/plans` 等规划材料中，不参与运行时路由。

## 已知生产边界

仓库已准备 `get-bank`、`submit-quiz`、`user-login`、`record-share` 四个后端函数，但当前没有发生真实 CloudBase 部署。用户仍需完成已授权 AppID、微信开发者工具扫码登录、CloudBase 环境选择、账号认证/服务类目/计费/审核发布条件，并只在云函数环境配置 `OPENID_HMAC_SECRET`。

`frontend-demo` 是 browser acceptance client，NOT native WXML/WXSS。原生客户端适配、真机/体验版测试、审核和正式发布是单独的生产阶段。本交接不需要 AppSecret。用户登录并选择 CloudBase 环境后，可以继续协助上传、部署和验证 repository-ready backend functions；本报告不声称这些外部动作已经完成。

## 最终代码审查修复周期

本周期从 `5520f1cc1a7b676348447f38cf1d4236bfd1a20f` 的干净工作树开始，由单一 Builder 完成，没有云端上传或部署。

修复后的公开结果由 `submit-quiz/public-result.js` 明确列出允许字段；`submit-quiz` 的 API 返回与 `quiz_records.result` 持久化，以及浏览器本地结果服务，全部复用该 DTO。内部算法仍可使用排序分数与标签目标向量，但公开结果不再包含 `scores_ranking` 或 `dimensions.target_vector`，也没有增加等价分数字段。UI 完整性检查只验证实际渲染所需的四维用户向量。

Markdown 编译器现在导出 `compileQuestionBanks({ write })` 并使用 CLI 入口保护。三版先在内存中完成编译，Q20 统一为 `self_perception_only`，题库统一绑定 `three-layer.v2.0.0`；所有题库与引用 profile 验证通过后才允许写入。`write:false` 和模块导入不会改写规范题库。

算法 profile 校验覆盖全部运行时消费字段，并对排除题号、核心匹配参数、领先阈值、距离度量、精度、候选分差和 Q20 角色执行显式类型与范围检查。Schema 只保留算法不变量为常量，数值和布尔调参项改为带范围的类型约束；用户向量按 `dimension.precision` 取精度，现有 precision=2 黄金结果保持不变。

版本注册表新增 `tag_prefix`。注册表、题库 Schema、独立校验器和构建器不再限定 H/U/G 或三个固定版本 ID；版本 ID、语义版本、缓存命名空间和公开文件名使用通用安全模式，并校验 ID、order、缓存命名空间、公开文件名唯一，默认版本存在且启用，题库身份/版本/profile 引用一致。内存中的第四版本 `continuing_education`（C 前缀）已证明无需修改前端或构建器业务分支即可通过校验并规划全部运行时产物。

### 本周期 RED / GREEN 证据

| 项目 | RED | GREEN |
| --- | --- | --- |
| A 公开结果隐私 | DTO 聚焦测试 0/1，缺少 `public-result` 模块；本地/UI 聚焦 23/28，三版仍暴露排序且 UI 仍要求目标向量 | DTO 1/1；本地/UI 28/28 |
| B 安全编译器 | 0/1，缺少受保护的 `compileQuestionBanks` 导出；测试在导入前失败，因此没有触发旧模块写入 | 1/1，三版 `write:false` 结果均通过题库/profile 校验且规范题库字节未变化 |
| C profile 完整校验 | profile 聚焦命令 1/4（3 项新校验失败）；precision 聚焦 0/1，实际仍为两位小数 | profile 聚焦 4/4；precision 聚焦 1/1，三位精度结果正确 |
| D 数据化第四版本 | 第四版本 0/1；注册表/Schema 0/2 | 第四版本 1/1；注册表/Schema 2/2 |
| E 禁止隐式大学版 | 0/1，`getBank()` 未拒绝缺失版本 | 1/1，中文错误在 cloud/fetch 调用前返回 |

### 本周期最终自动验证

| 命令 | 实际结果 |
| --- | --- |
| `node scripts/validate-question-banks.mjs` | exit 0；high_school、university、graduate 各 20 questions / 16 tags |
| `node --test tests/question-banks.test.js` | 11 tests，11 passed，0 failed |
| `cd campus_persona; npm.cmd run build:banks` | exit 0；`Built 3 banks` |
| `cd campus_persona; npm.cmd test` | 28 tests，28 passed，0 failed |
| `cd frontend-demo; npm.cmd test` | 41 tests，41 passed，0 failed |
| `cd campus_persona; node --test --test-name-pattern="changing only Q20" tests/algorithm.test.js` | 3 tests，3 passed，0 failed |

隐私扫描结果：公开 DTO/API/local 源路径中的 `scores_ranking` / `target_vector` 为 0 matches；三版本本地公开结果中的这两个 key 为 0；生成公开题库目录中的 `scores`、`core_questions`、`scores_ranking`、`target_vector`、`algorithm_profile` 为 0 matches。运行时构建器、独立校验器与通用 Schema 的固定三版本标识扫描为 0 matches。正常 `build:banks` 后只有四份 runtime registry 生成副本新增 H/U/G `tag_prefix`，旧 university-only 文件重建数为 0。最终 27 个变更路径全部位于 `SCTI_Study/`，`.env`、`memory_data`、`knowledge_base`、依赖与缓存保护路径命中数为 0。

本修复周期没有执行或声称完成 university / graduate 的完整浏览器流程；父级将在代码修复后独立完成这些浏览器验收。CloudBase 上传、部署和发布仍未发生。
