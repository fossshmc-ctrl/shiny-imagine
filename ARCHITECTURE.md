# V29 双运行时发布架构

V29 在不改写原有业务模块的前提下，把发布入口拆成静态前端和同源 API 两部分。同一份源码既可双击 `start.bat` 在 Windows 长驻运行，也可由 Vercel 分别构建静态站点与 Serverless Function。

## 1. 发布链路

```text
仓库根目录
  ├─ index.html / src / styles / assets
  │    └─ scripts/build-vercel.js → dist（唯一静态输出）
  ├─ api/index.js → server.js 的共享 API handler
  ├─ vercel.json（构建、重写、缓存与安全响应头）
  └─ start.bat → node server.js（Windows 本地长驻服务）
```

静态构建只复制浏览器需要的四类内容，主动阻止 `config.json`、私有 Token 文件、服务端源码、数据目录和测试进入 `dist`。这避免 V28.1.1 中“HTML 被发布、CSS/JS 路径却未完整发布”的半成品状态。

## 2. 运行时边界

- Windows：`server.js` 直接运行并监听 `127.0.0.1:8787`，JSON 数据可写在解压目录。
- Vercel：`api/index.js` 只转发一次请求给共享 handler，不启动常驻端口；可写数据重定向到 `/tmp/ai-linkuang-v29`，明确视为临时缓存。
- 前端：`src/core/deployment-runtime.js` 识别线上环境，负责访问口令、托管 Key 状态、Analytics 和大请求预检。
- API：线上只允许预设 EvoLink 主机，真实 Key 优先从 Vercel 环境变量读取，不返回浏览器。

## 3. 版本与部署校验

`npm run check` 会先检查 V29 版本标识、JS 语法、API 入口与 `vercel.json`，再执行静态构建并确认关键 CSS/JS/素材存在；同时确认敏感或非公开文件未进入 `dist`。`npm test` 继续运行既有功能回归与 V29 部署契约测试。

## 4. 原有业务分层（历史兼容说明）

以下内容记录 V27.9 起延续至 V29 的页面状态、区域编辑和生成通道设计。V29 不改变这些业务边界，只增加发布与运行时适配。

# V27.9 前端、区域文字编辑与微调恢复架构

V27.9 延续“全局路由持久化 + 页面状态自主管理”的分层结构，并继续保持文案生成、AI 线框、AI 生图与图片微调通道隔离。本版新增原生区域文案编辑稳定层和低频生图参数折叠层。

## 1. 全局路由层
- `src/core/route-persistence.js`：唯一负责顶层 route 的白名单、lastRoute 记录、reload 恢复、旧 key 迁移与非法值清理。
- 当前合法 route：`home`、`copy`、`integrate`、`image`、`adjust`、`users`、`audit`。
- `src/app/router-events.js`：每次 `render(route)` 先规范化 route，再写入 `turing_app_last_route_current`；启动时使用 `AppRoutePersistence.boot()` 决定首屏。
- route 层只回答“回到哪一页”，不保存文案、图片、生成任务、Token、区域数据等业务状态。

## 2. 页面状态生命周期
- `src/app/page-state-lifecycle.js`：定义各页面自己的恢复/清空策略。
- 文案生成：`localStorage` 保存可手动恢复的历史快照；`sessionStorage` 仅记录当前 copy runtime 是否允许 reload 恢复。
- AI 线框 / AI 生图：当前为 runtime-only，reload 后恢复页面位置，但临时任务状态按页面默认运行态重新初始化。
- 智能区域编辑：继续由区域工作台自己的 IndexedDB + sessionStorage 项目机制管理状态与子面板。
- 首页 / 用户管理 / 审计日志：不保存业务运行态。

## 3. 文案快照
- `src/core/copy-snapshot-store.js`：批次规范化、普通最近 5 批、active batch、星标保留与删除。
- `src/features/copy/copy-history.js`：只负责文案页面自己的持久化，不再记录全局 lastRoute。
- `turing_copy_generation_snapshots_current` 保存文案历史；不保存 API Token。

## 4. 生成通道
- 文案生成：扣子 Bot 独立通道。
- AI 线框 / AI 生图：共享图像 API，但不读取文案通道 Token。
- 图片微调：独立微调输出通道。

## 5. 发布版本规则
- Windows 发布包根目录只保留当前 V27.9 的发布说明与回归清单。
- 页面标题、服务健康检查、启动器、缓存版本、package/config 元数据统一为 V27.9 / 27.9.0。
- DOM/CSS 中历史形成的技术选择器继续作为兼容性标识，不作为发布版本号使用，避免无意义改名引发交互回归。

## 6. 验证
- `npm run verify`：结构、JS 语法、资源、路由白名单、页面状态生命周期、文案快照和既有功能单元/集成测试。
- Node/Python `/api/health`：验证 V27.9 buildId、生成通道与 18 张内置素材。

## V27.9 区域文案原生编辑稳定层

### 1. 根因隔离

“区域与文案”卡片采用文档级事件代理。旧判断只排除了 `input/select/option/button`，遗漏 `textarea`。因此点击 textarea 会同时触发区域卡片激活，随后 `renderOcr()` 重写 `.v15-result-content`，刚获得焦点的 textarea 节点被销毁。

V27.9 将所有原生交互元素从卡片激活分支排除，并把区域文本输入视为独立交互边界。

### 2. 编辑状态快照

在确有必要的 OCR 面板重绘前，`captureRegionTextEditorState()` 保存：

```text
region id
draft/value
focused intent
selectionStart / selectionEnd / selectionDirection
scrollTop / scrollLeft
```

重绘后 `restoreRegionTextEditorState()` 只在用户仍保持 textarea 编辑意图时恢复焦点。指针已落到其他按钮时，不执行焦点回抢。

### 3. IME 重绘屏障

`compositionstart` 将 `regionTextComposing` 置为 true。此时普通 `renderOcr()` 只设置 `regionTextRenderPending` 并返回，不替换 textarea。`compositionend` 保存最终值，并将积累的重绘合并为一次 `renderOcr({force:true})`。

### 4. 事件驱动替代轮询

V27.8 Smart Editor 安装器存在 90ms `setInterval`。V27.9 删除该轮询，改由以下事件驱动：

- OCR render 包装器；
- 工作台相关 MutationObserver；
- 区域变换 input/change/pointer；
- 文案 textarea focusout。

`mutationTouchesWorkbench()` 过滤与 `#v15-ocr-overlay` 无关的 DOM 变化，`nativeRegionTextBusy()` 在原生文字输入或 IME 组合期间暂停 Smart Editor 安装。

## V27.9 AI 生图参数折叠层

`imageModelParameterUi()` 仍先通过 EvoLink 模型能力矩阵规范化比例、分辨率和质量，然后生成摘要：

```text
数量 · 画幅 · 分辨率 · 质量
```

`img.parametersExpanded` 默认为 false。默认 DOM 只渲染横向 `data-img-parameter-toggle`；展开后才渲染 `.gen-options` 和当前模型说明。数量、质量、比例、分辨率变更不会关闭面板，重新渲染后摘要同步。

## V26 智能区域刷新恢复隔离

V26 在全局 route persistence 与区域项目 IndexedDB 之间增加独立的 `RegionRefreshAnchor` 层：

- `src/core/region-refresh-anchor.js`
- sessionStorage：`turing_region_v25_6_refresh_anchor`
- `mode=empty`：当前标签页的区域工作台应保持空白，F5 不允许从历史项目兜底恢复。
- `mode=project`：F5 只允许恢复明确指定的 `projectId`。
- 手动历史恢复只改变当前运行时项目，不修改 refresh anchor。
- `turing_region_v21_active_project` 在 V26 启动阶段被清理，不再参与 reload 选择。
- 区域项目 IndexedDB `turing_region_projects_v21` 保持不变，用于兼容已有的最多 5 个项目和各版本数据。

该分层解决“历史浏览动作修改全局 active 指针，导致下一次刷新恢复错误图片”的状态污染问题。

## V26 PaddleOCR 云端提交韧性层

V26 在浏览器识别工作台与 PaddleOCR 官方创建任务接口之间增加“本地提交调度层”。Node 与 Python 均保持同一语义：

1. 浏览器为每次识别生成 requestId，并 POST `/api/paddleocr-cloud/recognize`。
2. 本地服务仅对“创建 job”阶段进入 FIFO 全局队列；拿到 jobId 后立即释放锁。
3. PaddleOCR 返回 HTTP 400 / code 10010 时，归类为 `queue_busy`，按 3s/6s/12s/20s + jitter 进行有限重试。
4. `GET /api/paddleocr-cloud/queue-status?requestId=...` 暴露 queued/submitting/retry_wait/submitted/polling/downloading 等真实状态。
5. 浏览器轮询该本地状态接口，所以在 jobId 尚未确认前不会显示“任务已提交”。
6. 已提交 job 的云端轮询与结果下载不受提交锁影响，可并行进行。

该层只解决本地并发放大、临时云端拥塞和状态误导，不绕过 PaddleOCR 官方的账户/配额/服务限制。


## V27.1 EvoLink 生图额度就绪层

V27.1 将“接口可连接”和“可以创建计费生图任务”拆成两个状态：

1. `/api/diagnose` 继续检查本地代理、EvoLink 文件通道、模型目录与参考图转换，同时新增 `GET /v1/credits` 非计费余额检查。
2. Node 与 Python 都暴露本地 `GET /api/credits`，只代理 EvoLink 的 Credits 查询，不创建图片任务。
3. `EvoLinkImageAdapter.generate()` 在 `uploadReferences()` 之前执行 `ensureGenerationCredits()`；明确余额为 0 时不会上传参考图，也不会 POST `/v1/images/generations`。
4. HTTP 402 / `insufficient_quota` 统一归类为 `credits` 错误，在 UI 显示充值或调整 Token 额度的处理建议；调试日志仍记录原 HTTP 状态。
5. 如果 Credits 查询自身临时失败，预检采用 fail-open，以真实 `/images/generations` 返回为最终判断，避免因余额查询服务瞬时异常把所有生成永久锁死。

该层不绕过 EvoLink 官方计费或额度限制，只负责让诊断结论与真实生成条件一致，并在不可生成时更早、更清楚地阻止请求。


## V27.1 详情 AI 修改指令 -> 微调生图桥接

V27.1 将智能区域编辑的“详情 > AI 修改指令”从 UI/导出字段升级为真实生成输入：

1. 生成前读取并提交当前 textarea 最新值，不依赖 blur/change。
2. 每个区域保存独立 `regionAiTasks`：人工指令、有效 Prompt、sourceBBox、targetBBox、保护项、修复项。
3. `RegionAiPromptV271` 将人工 AI 指令放在最终 Prompt 顶部并标记为最高优先级，自动坐标仅作为执行约束。
4. 对移动/缩放任务，Mask 允许修改 source + target 两个区域，使模型可以移除旧主体、修补旧背景并在目标位置重新融合，避免只复制出第二个主体。
5. 第 2 张定位参考图加入 SOURCE/TARGET 辅助框；最终 Prompt 明确禁止把这些辅助元素复制进结果。
6. 多个同类型区域不再共用并覆盖第一条指令；多区域自动按全部有效区域联合执行。

这一层只改变微调生成的数据准备、Prompt 和 Mask，不改变 EvoLink API Key、Credits、文件上传、异步 task 或网络通道策略。

## V27.6 智能区域第二轮生成恢复

### 1. 诊断结论

用户截图中的第二轮并不是 preflight-only 本地假运行：`preflight/sync/compress/upload/submit` 都已经完成，task 已进入 `pending/processing`，但 `generationMs` 在约 150 秒处停止，`completed` 未出现。这一特征对应 V27.5 的 provider poll 硬上限，而不是区域 handoff 失败。

深度网络诊断还显示：Apifox 代理路径在 TLS 建连前断开，但真实 EvoLink 文件 GET 和两种上传均成功。因此 Apifox 不能作为 EvoLink 可用性的唯一判据。

### 2. 当前完整链路

```text
用户点击微调生成
  -> 新 performance sessionId
  -> preflight：5 分钟完整诊断缓存 / 60 秒 Credits
  -> sync：区域 native apply + 直接 handler acknowledgement
  -> compress：source + layout/mask guide
  -> upload：2 路并发
  -> submit：唯一一次计费 POST，创建 task_id
  -> pending / processing
  -> 180 秒软阈值
       -> 继续 GET 同一个 task_id
       -> 临时 TLS/Socket 错误最多安全重试 3 次
       -> 不重新 POST 生图任务
  -> completed
  -> result pixels
  -> postCheck
```

### 3. 轮询预算

`src/core/evolink-image-adapter.js` 定义：

```text
POLL_SOFT_TIMEOUT_MS = 180000
POLL_TIMEOUT_MS      = 360000
POLL_MAX_TIMEOUT_MS  = 480000
POLL_RETRY_DELAYS_MS = [600, 1500, 3000]
```

软阈值只改变 UI 与 active budget，不代表失败。只有同一 task_id 达到最终有界预算仍未完成，客户端才停止查询。超时对象保留 taskId、pollRetryCount、networkStallMs 和实际预算。

恢复只包裹 `/tasks/{task_id}` 的 GET。`/images/generations` POST 没有自动重试层，避免在响应不确定时重复计费。

### 4. 代理与 Keep-Alive 隔离

`network-keepalive.js` 的 HTTPS CONNECT Agent 从“每个代理一个池”改为：

```text
proxy URL + target authority -> agent
```

因此：

```text
127.0.0.1:17890 + api.evolink.ai:443
127.0.0.1:17890 + files-api.evolink.ai:443
127.0.0.1:17890 + echo.apifox.com:443
```

是三个独立池。某一目标出现 TLS 预连接错误时，`invalidateHttpsProxyAgent(proxy,target)` 只销毁对应目标的连接池。

Node 服务会在自动代理发生可恢复 TLS/preconnect 错误时：

1. 标记该 route 连续失败；
2. 隔离 90 秒；
3. 清除自动代理解析缓存；
4. 销毁该目标的代理 Agent；
5. 仅在请求可以安全切换时尝试直连/其他路线。

Python 服务保持同等的路由健康、隔离和安全 failover 语义。

### 5. 路由健康评分

V27.6 的 micro route health 采用有界、衰减状态，而不是无限累计成功次数。评分参考：

- 最近成功/失败；
- 连续失败次数；
- 暂时隔离截止时间；
- 请求是否属于 safe preconnect failure；
- GET 与可能已经发送 body 的 POST 风险不同。

这使第一轮成功的代理不会在第二轮即时 TLS 失败后继续长期占据优先级。

### 6. 权威网络诊断

诊断条目有 `required / severity / authoritative / advisory` 语义。

辅助探针：

- 公网直连 Apifox Echo；
- 当前代理路径 Apifox Echo。

权威 EvoLink 项：

- 生图 API `/models`；
- 文件服务 quota/GET；
- 1×1 PNG 独立上传；
- 800×800 实际参考图上传。

总体 `ok` 只由 required 权威项决定。辅助探针失败时设置 `warning=true`，UI 显示黄色警告和“真实 EvoLink 路径仍可用”的说明。

### 7. 性能遥测

原九阶段继续保留：

```text
preflightMs / syncMs / compressMs / uploadMs / submitMs /
providerQueueMs / generationMs / resultMs / postCheckMs
```

新增恢复字段：

```text
softTimeoutReached
pollRetryCount
networkStallMs
pollTimeoutBudgetMs
pollMaxTimeoutMs
sameTaskOnly
```

UI 在 task 生命周期下显示“轮询恢复”行，明确告知用户是否已越过软阈值、重试了多少次 GET、网络停顿时长、当前预算和上限。

### 8. V27.4/V27.5 防重复计费机制继续保留

- Base URL/API Key/Model identity 变化才清预检缓存。
- 完整诊断缓存 300000ms；Credits 缓存 60000ms。
- 每次点击生成新的 sessionId 和 generationId。
- `__V276_START_MICRO_ADJUST__` 直接调用当前生成处理器；`__V275_START_MICRO_ADJUST__` 仅为兼容别名。
- handler 必须在第一处 await 之前 acknowledgement。
- 浏览器与服务端同时核对 `X-Channel`、generationId 和 `X-Micro-Handoff-Acknowledged`。
- 本地 orphan run 阈值提高到 600000ms，避免真实长任务被 210 秒陈旧恢复机制误判。

### 9. 逻辑隔离与物理共享

普通生图和智能区域微调仍可能共享 VPN/Clash、出口带宽和同一个 EvoLink 账户队列。V27.6 不声称物理网络完全隔离，而是通过 target-scoped Agent、route quarantine 和性能分段，让共享链路的影响可恢复、可观测、不会导致重复计费。

## V27.7 Smart Region prompt/text/output stability layer

V27.7 introduces `src/core/region-prompt-state.js` between OCR/region state and the generation prompt bridge.

```text
Region geometry changes ───────┐
                               ├─ RegionPromptStateV277.compose() ── current AI instruction
Manual AI requirement ─────────┤
OCR text correction ───────────┘
```

The manual requirement is stored independently. Geometry and text facts are regenerated from the current region model, so canvas move/resize operations cannot be frozen by a prior textarea edit.

Text corrections use the same region object and are converted into a deterministic replacement/delete/insert instruction before `RegionAiPromptV273` builds the billed provider prompt.

Result actions use the existing global modal but add `v277-region-modal` while the full-screen region overlay is active. Remote image downloads continue through the local image-export proxy to avoid browser CORS/tainted-canvas failures.


## V27.8 mixed-region prompt bridge

### Root cause

V27.7 gathered `userIntent` and `effectiveInstruction` into two arrays and then selected one array for the whole request:

```text
if any selected task has user intent
    use only the user-intent array
else
    use the effective-instruction array
```

A text correction on one OCR region therefore removed the automatic instructions of every other selected task. `RegionGenerationRegression.verifyBridge()` correctly stopped the flow before compression/upload because those tasks no longer appeared in the provider Prompt.

### Per-task resolution

V27.8 resolves the primary instruction independently for each selected task:

```text
user instruction
  -> effective live instruction
  -> same-index fallback
  -> generated default instruction
```

`priorityEntries()` maps every task without filtering out empty/manual-missing rows. `compactTask()` stores `prompt_source`, so diagnostics can distinguish `user`, `effective`, `fallback`, and `generated-default` instructions.

```text
selected OCR tasks ──┐
manual text edits ───┼─ taskPrimaryInstruction(task) ─┐
free-added regions ──┘                                ├─ final provider Prompt
live source/target geometry ──────────────────────────┘
```

The final Prompt explicitly states that every selected region must execute and that one manual text correction must not suppress automatic or free-region tasks.

### Free-region migration

New free regions receive an explicit `freeInstruction` at creation and store it in `__v173ManualRequirement`. Existing projects are recognized through `manualCreated`, `manual-free-region`, `manual-brush`, or `custom_*`; `RegionPromptStateV278.freeRegionInstruction()` supplies a stable migration instruction when old state has no manual requirement.

### Draft commit and free-region persistence

Before the native Apply bridge runs, V27.8 commits both active edit surfaces in this order:

```text
document-block correction draft
  -> active region text draft
  -> active AI prompt editor
  -> regionAiTasks
  -> regression guard
```

This prevents the visual textarea value from being newer than the task state. `preserveManualRegions()` now treats `manualCreated` and `manual-free-region` as manual state, so a “preserve manual regions” recognition pass cannot silently discard a free-added region.

### Regression boundary

Prompt regression remains before reference serialization, upload, and the single billed `/images/generations` POST. The matcher decodes JSON-escaped newlines/quotes before fuzzy comparison, and the guard returns `missingInstructionRegionIds` for actionable local errors. This fix changes only prompt preparation and does not relax the no-duplicate-billing gates from V27.4–V27.7.
