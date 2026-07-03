# phoenix-wing 依赖配置

## 背景

`phoenix-wing` 已发布到 npm registry（`0.1.4`），但也需要支持本地联调（修改 phoenix-wing 源码的同时在 open-issue 中即时验证）。

方案：**Vite 自动检测**，本地有就用本地，没有就用 npm，无需手动切换。

## 原理

`packages/web/vite.config.ts` 在启动时检查上级目录是否存在 `phoenix-wing/src`：

```
phoenix/              ← 你的工作目录
├── phoenix-wing/     ← 如果存在这个目录……
│   └── src/
└── phoenix-open-issue/
    └── packages/web/
        └── vite.config.ts   ← 这里检测并自动 alias
```

```ts
const localWingSrc = resolve(__dirname, '../../../phoenix-wing/src')
const hasLocalWing = fs.existsSync(localWingSrc)

resolve: {
  alias: {
    '@': resolve(__dirname, 'src'),
    ...(hasLocalWing ? { 'phoenix-wing': localWingSrc } : {}),
  },
},
```

- **有** `../phoenix-wing/src` → Vite alias 指向本地源码，修改即时热更新
- **没有** → 无 alias，走 node_modules 中的 npm 版本

## 用法

```bash
pnpm dev
```

就这一条命令，无需区分模式，无需 `pnpm link` / `pnpm unlink`。

## 判断当前用的是哪个

```bash
ls -l packages/web/node_modules/phoenix-wing
```

- 路径包含 `.pnpm/phoenix-wing@0.1.4` → npm 版本
- 路径包含 `../../phoenix-wing` → 本地版本（仅当 Vite alias 未覆盖时出现；alias 优先级更高，所以 Vite 实际会用本地源码）
