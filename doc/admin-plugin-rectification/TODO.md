# Admin 插件迁移 TODO

状态：active

本文件只保存会影响实现或验收的短清单。详细的跨项目统计、审计底稿和历史快照后续归档到同级仓库 `phoenix-ai-workspaces`；构建门禁和可执行脚本继续留在源码仓库。

## Issue 业务闭包

- [x] 列表管理、列表详情、Issue 详情原样迁移；
- [x] 点检表单、状态、时间线及调度算法纳入依赖闭包；点检不是遗漏的独立 View；
- [x] 推送发起弹层、推送历史原样迁移；
- [x] 8D 报告列表和 Issue 内 8D 弹层原样迁移；
- [x] 仪表盘和任务中心原样迁移；
- [x] 通过 Pah manifest 为仪表盘、推送历史和 8D 报告登记动态路由/菜单，不再依赖旧开发桥；
- [x] 迁移 Midway Controller、Service、Entity 与 manifest v2 SQL migration，让上述页面接入真实 API；
- [ ] 用真实数据完成点检编辑/状态切换和推送接受/拒绝/撤回；8D 增删改及 Issue 关联已完成临时数据回归并清理。

## 附属入口

- [x] 原样迁移功能简表，保留筛选、排序、增改停用、XLSX 导入、JSON 导出和 Issue 关联；
- [x] 将功能数据迁入插件表 `oip_function`，不归入 Host 设置；
- [x] 迁移 Open Issue 单元测试页面，执行端改为固定插件测试集、开发环境/管理员限制、目录白名单、锁、超时和输出上限；Host 任务/文件报告仍待平台接口；
- [x] 恢复插件维护入口中的 Issue 数据库修正；Issue 字典继续复用 Host namespaced 字典，不复制设置页；
- [x] 数据库修正先完成 `checkpoints` / `links` 的纯规划算法与管理员 Midway API；拒绝 schema、Host 用户和 SQLite 任务；
- [ ] 密码、登录方式、用户和组织改为 Host 入口，不复制旧设置实现；
- [ ] 按《附属入口迁移归属》完成 legacy/Admin 双开点检。

## 图标能力

- [x] 修复空图标和问号：Pah 重物化 manifest 的 `pnw:*` 稳定 ID，Wing 对未知 ID 显示可见 fallback；
- [x] 把 legacy 页面图标能力迁为 `pnw:` / Host namespace 注册与解析契约；
- [x] 明确 Pah manifest/Nav 只保存稳定 icon ID，不序列化 Vue Component；
- [x] 由 Host/Wing renderer 解析 icon ID，避免插件全局注册组件；
- [x] Dashboard、Lists、Push History、8D 已显示真实 SVG 且无 fallback，并验证旧问号来自旧标签模块缓存；
- [ ] 将图标契约做成 Admin Fixture 插件示例，供 Function、Bom3 直接照用。

## COOL / Wing 复用研究

| 能力 | 当前结论 | 状态 |
| --- | --- | --- |
| 登录、token、当前用户 | 复用 `useBase().user`；插件不迁移 Login/OAuth/会话存储 | 已接入 |
| 用户列表、启停 | 复用 `service.base.sys.user`；领域层 ID 保持 string，由 adapter 转换 | 已接入首切片 |
| 部门/组织 | 复用 COOL 用户管理 `/sys/user` 与部门服务；插件只保存业务成员关系 | 待固化 SDK |
| 数据字典 | `issueCategory`/`detectionPhase` 复用 COOL；重要度/紧急度保留固定协议并仅覆盖显示名；核心 listType/closeReason 由插件加保护 | 方案已定，待实现 |
| 路由/菜单/Tab | 短产品路由 `/open-issue/*`，唯一技术 ID `phoenix-open-issue`；Pah 管注册，Vue Router 管页内跳转 | 已接入首切片 |
| Wing 区域贡献 | 旧 POI facade 统一转到 Pah registry，不迁第二套 Workbench | 已接入首切片 |
| 文件上传 | 复用 COOL comm/upload 与 Host 存储策略，插件只保存业务附件引用 | 待研究 |
| 权限 | Host capability 是上限；列表成员、所有者、Issue 可见范围仍属于插件领域算法 | 待后端闭环 |
| 审计、任务、参数、备份 | 使用 Host lifecycle/adapter，不在插件中复制平台表和管理页 | 待后端闭环 |

判定规则：只有语义和生命周期都属于平台的能力才复用 Host；Issue 分类、点检状态、列表成员等领域含义不能为了减少文件数而错误塞入平台公共模型。

## Host 业务副本清理

- [x] Midway Controller、Service、Entity、migration 和产品测试迁回插件包；
- [x] Host 从插件 manifest 注册业务路由、菜单、能力码与 API namespace；
- [x] 删除 Phoenix Admin Vue 的临时桥、Open Issue 设置页和 `OpenIssuePrototypeManifest.ts`；
- [x] 删除 Phoenix Admin Node 的 `src/modules/open-issue`，验证 Pah 离开任何内置业务模块仍可独立工作；
- [x] 将 Admin Fixture 改为通用示例，不把 Open Issue 固化成框架内置样例。

详细历史证据归档在 `phoenix-ai-workspaces/open-issue/work/Host中OpenIssue业务副本调查-2026-08-01.md`。

## 统一审计

- [x] 增加可复算的文件数、行数、源码字节和测试用例统计脚本；
- [x] 固定 UI、算法、测试、Host adapter、未迁移平台壳的统计口径；
- [x] 前端受控挂载 production build 通过；9 个路由入口含 CSS 为 186,774 bytes raw / 64,000 bytes gzip，同一 Host 无插件基线的完整 dist 增量为 293,515 / 101,339 bytes；当前构建未生成 brotli；
- [x] 后端隔离 production build 通过并记录源码包压缩/解包体积、dist descriptor/SQL 大小与 SHA；
- [ ] Issue API 闭环后发布最终审计报告；
- [x] Function、BOM 使用同一 Skill 与审计模板：Function 已到 55% 并完成双库恢复演练，BOM 首只读纵切 75% 并量化避免复制 45 文件/5,876 行 Host 壳层。
