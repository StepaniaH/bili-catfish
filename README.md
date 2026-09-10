# Bili Catfish

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/bcdjalhonemelcdclkcfhblgilgmjccb?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/bili-catfish/bcdjalhonemelcdclkcfhblgilgmjccb)

Bili Catfish 是一个 Bilibili 网页端浏览器扩展（Chrome，Manifest V3）。它记住你在 Bilibili 原生界面表达过的「不感兴趣」，在相同视频或相同 UP 主的内容再次出现时将其模糊遮挡——悬停可临时查看，点击仍可正常观看，随时可解除。

所有数据只存在你的浏览器本地。没有账号系统，没有服务器，没有统计埋点。

## 功能

- **记住「不感兴趣」**：在首页推荐流、搜索结果页、视频页相关推荐中，通过 B 站原生菜单表达「不感兴趣」或「不喜欢该 UP 主」，扩展会捕获并把内容记入本地规则。
- **持续遮挡**：相同视频（按 aid/bvid）或相同 UP 主（按 mid）再次出现时，卡片被模糊打码，显示「已屏蔽该视频 / 已屏蔽该 UP 主」。悬停临时查看，移出恢复，点击可正常观看。
- **一键解除**：打码卡片右上角悬停可见「不再屏蔽该视频 / 不再屏蔽该 UP 主」；点击 B 站遮挡层的「撤销」也会同步删除对应规则。
- **类型打码**（全部默认关闭，在管理页开启）：
  - 屏蔽广告：带「广告 / 推广」角标的卡片；
  - 屏蔽推广：封面右下角带小火箭标记的付费推广视频；
  - 分类卡片屏蔽：课堂、国创、综艺、番剧、直播、电影、电视剧、纪录片、漫画（角标精确匹配）。
  类型打码的卡片悬停可看、无解除按钮，关闭开关即恢复，不产生规则。
- **UP 主主页提示**：访问已屏蔽 UP 主的主页（space.bilibili.com）时，页面顶部显示横幅提示，可一键解除；主页内容不打码。
- **管理页**：查看 / 解除 / 导入 / 导出 / 清空所有规则，暂停插件。
- **提速**：二次访问时视频信息走本地会话缓存，打码近乎即时。

## 安装

### Chrome Web Store（推荐）

从 [Chrome Web Store](https://chromewebstore.google.com/detail/bili-catfish/bcdjalhonemelcdclkcfhblgilgmjccb) 安装，后续版本更新自动推送。

### 从源码构建（开发者）

```bash
npm install
npm run build
```

Chrome 打开 `chrome://extensions`，开启「开发者模式」，选择「加载已解压的扩展程序」，指向 `dist/` 目录。

## 隐私

- 屏蔽数据仅保存在浏览器本地 `chrome.storage.local`，不上传、不同步、不收集任何账号信息。
- 扩展仅向 `api.bilibili.com` 发起只读的视频信息查询（把卡片链接换算成 aid/bvid 与 UP 主 mid，用于规则匹配），不携带任何本地数据。
- 不请求 bilibili.com 以外的任何站点，不含统计、埋点或远程配置。
- 捕获「不感兴趣」与广告识别依赖向页面注入的请求观察脚本（`MAIN` world）：只读识别 `feedback/dislike`、`feedback/dislike/cancel` 请求，以及首页/搜索/相关推荐接口的响应数据（仅用于本地识别广告/推广卡片），不做其它用途，不上传任何数据。

权限说明：`storage` 用于本地保存规则；`api.bilibili.com` 主机权限仅用于上述只读查询；内容脚本仅在 Bilibili 相关页面运行。

## 开发

```bash
npm test          # Vitest 单元测试
npm run typecheck # TypeScript 检查
npm run build     # 构建到 dist/
npm run watch     # 监听构建
```

技术栈：TypeScript（strict）、esbuild（IIFE）、Chrome MV3、零运行时依赖。

支持页面：Bilibili 首页推荐流、搜索结果页、视频页相关推荐、UP 主主页（仅横幅）。Bilibili 改版可能导致选择器或端点失效；发现失效时欢迎提 Issue。

## License

[MIT](LICENSE)
