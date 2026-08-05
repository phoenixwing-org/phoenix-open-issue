# Issue 批量迁移执行记录

状态：active

基线：`legacy/2cdc5ea`

目标分支：`admin`

## 1. 当前决定

- `legacy` worktree 冻结为页面、交互和算法金样本，不在其上做 MVC 改造；
- `admin` 已从 `2cdc5ea` 重新建立，旧 Admin 试验线保存在 `archive/admin-plugin-495ab91`；
- Phoenix Admin Vue/Node 的 `codex/open-issue-plugin` 只提供 COOL 结构、Host API 和生命周期参考；其中重新设计的 `oip-*` 页面不是迁移来源；
- SQLite、独立登录、独立 AppShell 和 Express Server 不进入插件包，因此不先重构或删除独立版实现；
- 先批量放入 UI 与算法，允许中间阶段接口未接通；之后按错误类别集中修正。

## 2. 插件脚手架

```text
packages/admin-plugin/
├── manifest.json
├── vue/phoenix-open-issue/       # 对应 Phoenix Admin Vue src/modules/phoenix-open-issue
└── midway/phoenix-open-issue/    # 对应 Phoenix Admin Node src/modules/phoenix-open-issue
```

这与 COOL 模块插件的交付方式一致：前端模块放入 Vue 项目的 `src/modules`，后端模块放入 Midway 项目的 `src/modules`。`phoenix-` 是业务插件的技术命名空间，用于避免与第三方 COOL 模块重名；菜单仍显示产品名。Pah manifest 负责稳定路由、能力码、数据归属和受控生命周期。

技术身份与产品 URL 分离：源码目录和 `moduleId` 使用 `phoenix-open-issue`，能力码及后端 API 跟随该唯一命名空间；manifest 的 `routePrefix` 固定为短路径 `/open-issue`，用户不需要输入带厂商前缀的长 URL。

## 3. 当前 Issue 迁移范围

主 View：

- 列表管理；
- 列表详情；
- Issue 详情；
- Issue 推送弹层；
- 推送历史；
- 8D 报告；
- 仪表盘及任务中心。

依赖闭包：

- Issue 表单、快捷编辑、列设置、点检时间线、8D、成员管理等组件；
- Issue/List/Auth/Dict/Function/Settings Store；
- API 调用外形、列配置、页面帮助和生命周期工具；
- `packages/core/src` 下的类型、权限、推送、调度和导入算法。

其中点检不是独立路由：点检新增/编辑表单、状态标签、列表最近点检和 Issue 点检时间线已经随列表详情、Issue 详情一起进入闭包。

不进入插件业务页面：

- 独立 AppShell、登录/OAuth 页面和独立 Router；
- SQLite/PG Adapter、Express Controller/Service；
- Host 全局设置、组织管理和测试页面；
- Phoenix Admin Host 原型中的重写页面。

## 4. UI 保真门禁

`scripts/verify-admin-plugin-ui-fidelity.mjs` 对每个迁移 Vue 文件提取完整 `<template>` 与 `<style>` 块，并与 `legacy/2cdc5ea` 工作树中的源文件逐项比较。

允许修改 `<script>` 以完成：

- `@/` 到 COOL 模块路径的转换；
- `@open-issue/core` 到插件内 Core 的转换；
- 独立请求客户端到 Host 请求端口的转换；
- 独立 auth/router/dict 到 Host adapter 的转换；
- POI View Contribution 到 Pah View Contribution 的转换。

任何模板或样式变化都必须先解释原因，并作为单独的产品/UI 决策；不能混在接口修复中。

## 5. 后续修正顺序

1. 只改 import 和模块路径，使迁移闭包自洽；
2. 用单一 Host facade 替换独立 Axios、token 和 Router 依赖；
3. 映射 `/api/*` 到 `/admin/phoenix-open-issue/*`，保持原 Store 调用签名；
4. 将 actor、用户、部门、字典和 capability 接到 Host；
5. 将旧 POI View Contribution 接到 Pah registry，保持原 Primary/Secondary 可见内容；
6. 最后处理 TypeScript/编译错误，不以重写页面作为修复手段；
7. 在 Phoenix Admin Fixture 中安装同一插件源码包，进行截图和交互对照。

图标注册、真实 Midway API、COOL 字典/部门/文件复用与正式交付尺寸见 [TODO](TODO.md)；当前统计与验收口径见 [迁移审计](迁移审计.md)。

## 6. 可复用规则

Function 和 Bom3 使用同一方法：

1. 指定不可变金样本提交；
2. 建立 View 及依赖闭包映射；
3. 批量复制，不边搬边重画；
4. 锁住 template/style；
5. 只在 script、adapter、controller/entity 层解决宿主差异；
6. 完成 Host Fixture 验收后，才允许讨论页面改版。
