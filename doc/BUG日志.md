# Bug 记录

## pnwPromptChoice 对话框不显示（SettingsView）

**日期**：2026-07-07

**现象**：设置页面点击按钮（软件默认值、删除等）无反应，`pnwPromptChoice` 对话框不弹出。但点击事件正常触发，其他页面（列表详情）的 `pnwPromptChoice` 正常工作。

**根因**：Vite 预打包 `phoenix-wing` 导致模块级状态分裂。

`pnwPromptChoice` 使用模块级 `ref` 控制对话框显示：

```
SettingsView  ──写入──→  ref (预打包 chunk 内)
PnwChoiceDialogHost ──读取──→  ref (原始 .vue 文件内)
                                    ↑ 不是同一个实例！
```

Vite 的 `optimizeDeps` 把 `phoenix-wing` 的 TS 部分打成 chunk，但 `.vue` 文件不参与预打包。`PnwChoiceDialogHost.vue` 内部的相对导入 `../composables/pnwChoiceDialog` 指向原始源文件，而 SettingsView 的 `import { pnwPromptChoice } from 'phoenix-wing'` 指向预打包 chunk——两份模块各自创建了独立的 `ref(false)`。

**修复**：[packages/web/vite.config.ts](../packages/web/vite.config.ts)

```ts
optimizeDeps: {
  exclude: ['phoenix-wing'],
},
```

禁止预打包 phoenix-wing，所有导入走原始源文件，确保模块级状态唯一。

**教训**：有模块级可变状态（`ref`、单例等）的依赖，必须排除 Vite 预打包，否则状态分裂。
