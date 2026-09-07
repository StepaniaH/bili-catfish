# Bili Catfish

Bili Catfish 是一个 Bilibili 网页端浏览器扩展：记住你在 Bilibili 原生界面表达过的「不感兴趣」，并在相同视频或相同 UP 主的内容再次出现时遮挡它们（悬停可临时查看、可点击观看、可随时解除）。

## 安装（开发模式）

1. `npm install`
2. `npm run build`
3. Chrome 打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `dist/` 目录。

## 使用

- 在 Bilibili 首页 / 搜索页 / 视频页相关推荐，点击视频卡片菜单里的「不感兴趣该视频」或「不喜欢该 UP 主」，Bili Catfish 会自动记录。
- 之后相同内容再次出现时，卡片会被模糊遮挡，并显示「已屏蔽该视频 / 已屏蔽该 UP 主」。
- 悬停临时查看；移出自动恢复遮挡；点击仍可正常观看（不会解除屏蔽）。
- 卡片右上角悬停可见「不再屏蔽该视频 / 不再屏蔽该 UP 主」。
- 点击扩展图标或工具栏菜单进入「管理屏蔽列表」：查看、解除、导入、导出、清空、暂停。

## 隐私

所有屏蔽数据仅保存在浏览器本地（`chrome.storage.local`），不上传、不同步、不收集任何账号信息。插件仅向 `api.bilibili.com` 发起只读的视频信息查询（用于把视频链接换算成唯一 ID 与 UP 主 ID）。

## 开发

- `npm run build`：构建到 `dist/`
- `npm run watch`：监听构建
- `npm test`：单元测试（Vitest）
- `npm run typecheck`：TypeScript 检查

支持页面：Bilibili 首页推荐流、搜索结果页、视频页相关推荐。Bilibili 改版可能导致选择器或端点失效，相关记录见 `docs/bili-dislike-endpoints.md`。
