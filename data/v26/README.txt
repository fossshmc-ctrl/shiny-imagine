V26 本地持久化数据目录

wireframe-history.json
  AI 线框生成历史元数据。程序会自动维护。

wireframe-history-assets/
  已生成线框图的本地持久化副本，避免远程临时 URL 失效。

image-tasks.json
  EvoLink 异步生图任务中心。保存 task_id、模型、Prompt、提交时间、状态、进度、失败原因和结果地址。

注意：
1. 这些文件属于运行数据，正常使用时请不要手工修改。
2. 升级或迁移程序时，如果需要保留历史，请同时备份整个 data/v26 目录。
3. 删除某条历史记录时，程序会同步清理对应的本地线框图片副本（如果存在）。
