图灵线框工作台 V29.1
Windows 本地版 + GitHub / Vercel 在线预览版

一、V29.1 解决了什么

1. 修复 V28.1.1 直接上传 Vercel 后页面无样式、SVG 图标被放大的问题。
2. 增加固定的 Vercel 构建输出目录 dist，HTML、CSS、JS、图片会完整发布。
3. 增加 /api 统一 Serverless 入口，线上不再尝试启动长期驻留的 server.js。
4. Windows 仍可双击 start.bat 使用，Node 不存在时继续保留 Python 兼容入口。
5. 压缩包内部不再套一层同名目录。Windows“全部解压”后即可直接看到 vercel.json、package.json、index.html 和 start.bat。
6. 加入可选的小范围访问口令、线上环境变量密钥、4.5MB 请求体提示和 Vercel Web Analytics 接入。
7. 修复 Vercel 设置访问口令后，AI 线框图生成成功、下载正常但页面预览显示破损的问题。

二、最快开始

Windows 本地使用：

1. 解压压缩包。
2. 双击 start.bat。
3. 浏览器打开 http://127.0.0.1:8787/。
4. 按页面提示配置 EvoLink、扣子或 PaddleOCR。

GitHub + Vercel 持续同步（推荐）：

1. 把“解压后的全部内容”放到 GitHub 仓库根目录。
2. 确认仓库首页能直接看到 vercel.json、package.json、index.html；不要只上传外层文件夹。
3. 在 Vercel 新建项目并 Import Git Repository。
4. Root Directory 选 ./；Framework Preset 选 Other 或让 Vercel 自动识别。
5. Build Command 和 Output Directory 不需要手填，仓库中的 vercel.json 已指定。
6. 在 Vercel Project Settings → Environment Variables 填写所需变量。
7. Deploy。以后分支提交会产生 Preview，main 分支更新会自动进入 Production。

没有长期同步需求：

可在 Codex 中连接并登录 Vercel 插件，然后让 Codex 把本目录部署为 Preview。确认无误后再发布 Production。V29.1 已准备好构建命令、输出目录和 API 路由，不需要再次调整包体。

三、Vercel 环境变量

强烈建议：

AI_LINKUANG_ACCESS_CODE
小范围测试访问口令。设置后，线上 API 必须验证口令；口令只保存在使用者当前浏览器标签页。

EVOLINK_API_KEY
线上统一使用的 EvoLink Key。设置后，浏览器只看到 server-managed 占位状态，不会取得真实 Key。

按需设置：

EVOLINK_BASE_URL=https://api.evolink.ai/v1
COZE_API_TOKEN
PADDLEOCR_ACCESS_TOKEN
AI_LINKUANG_ALLOWED_API_HOSTS

AI_LINKUANG_ALLOWED_API_HOSTS 只填写主机名，多个用英文逗号分隔。线上默认只允许 api.evolink.ai 与 direct.evolink.ai，避免项目变成任意地址代理。

不要把真实密钥写进 .env.example、config.json、GitHub 文件或压缩包。

四、Vercel Analytics

部署成功后，在 Vercel 项目中打开 Analytics 并点击 Enable。
V29.1 在线运行时会自动加载 Vercel Web Analytics；Windows 本地运行不会加载，也不会出现本地统计请求。

五、V29.1 在线版的重要限制

1. Vercel Function 单次请求/响应存在 4.5MB 载荷限制。V29.1 会在浏览器端提前拦截明显超限的图片请求并给出中文提示。超大图、多张高清参考图建议使用 Windows 本地版。
2. Vercel 文件系统只有 /tmp 可写，且不保证跨实例持久化。V29.1 的 AI 线框图不再写入 /tmp，也不会把预览替换成受口令保护的临时资源地址；线框历史保存在当前浏览器并继续使用 EvoLink 原始图片地址。
3. V29.1 将线上 Function 单次执行上限设为 300 秒，以兼容 Hobby 套餐。PaddleOCR、扣子或图片任务如果超过该时间会被平台终止；长任务优先使用 Windows 本地版，或后续接入持久任务队列。
4. 如果要让多人共享历史、任务和图片，需要再接数据库/对象存储；V29.1 没有假装 Serverless 临时磁盘是长期数据库。
5. Vercel Preview 和 Production 的环境变量可分别设置。请确保需要测试的 Preview 环境也勾选了相应变量。

六、目录说明

api/index.js
Vercel Serverless API 统一入口。

scripts/build-vercel.js
只复制可公开的前端文件到 dist，并阻止 server.js、私有配置、数据和测试文件进入静态站点。

vercel.json
Vercel 构建、输出、API 重写、页面路由和缓存策略。

server.js
Windows Node 服务和 Vercel API 共用核心；只有直接运行时才监听本地端口。

src/core/deployment-runtime.js
线上访问口令、环境识别、Analytics、Serverless 载荷限制和托管密钥接管。

start.bat
Windows V29.1 启动器。

七、上线后的快速检查

1. 首页导航、卡片、图标均有完整样式，不出现巨大黑色 SVG。
2. 打开 /api/health，version 应为 V29.1，runtime 应为 vercel-serverless，assetsReady 应为 true。
3. 设置了 AI_LINKUANG_ACCESS_CODE 时，首次进入会出现访问口令框。
4. CSS 与 JS 请求状态为 200，不应返回 HTML。
5. 测试 API 配置、模型列表和一次小图片生成。
6. 在 AI 线框页生成一次：右侧预览应完整显示；F12 Network 不应再出现新的 /api/wireframe-history/assets 请求；下载仍应正常。
7. 在 Vercel Deployments 中保留上一版，发现问题可直接回滚。

更完整的部署步骤见 V29.1-DEPLOYMENT-GUIDE.txt。
