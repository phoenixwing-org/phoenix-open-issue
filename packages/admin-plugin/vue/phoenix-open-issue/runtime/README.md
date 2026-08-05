# PageHelp browser runtime

此目录保存 Open Issue 插件自带的浏览器运行时制品，Host 不安装 `driver.js`，也不为产品添加 alias。

- 来源锁定为 `packages/admin-plugin/package.json` 中的精确 build-only `driver.js` 版本；
- `pnpm admin-plugin:build-browser-runtime` 从已安装源包复制其自包含 ESM、CSS、类型和 MIT license；
- `browser-runtime.artifacts.json` 固定路径、格式、raw/gzip 大小和 SHA-256；
- verifier 要求 ESM `externalImports=0`，CSS 不得含 `@import`、`@font-face` 或 `url(...)`；
- `PageHelpButton.vue` 只能相对导入本目录制品。

生成制品后必须运行 `pnpm admin-plugin:verify`，并在真实 Admin Host 中打开和关闭一次页面导引。
