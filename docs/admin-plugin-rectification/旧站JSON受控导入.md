# 旧站 JSON 受控导入基线

## 原始证据

- 原文件：用户本机“下载”目录中的 `migration-2026-08-03.json`；仅只读研究，不复制到 Git。
- 文件大小：39,220 bytes。
- SHA-256：`4ea81e9460dfb2d9ea5610cea84c130d25a20b32681548cee90addc85c50d2b5`。
- 包格式：`version=1`、`exportScope=full`、导出时间 `2026-08-03T22:45:23.638Z`。
- 原包含密码哈希、账号、组织、业务文本与字典，因此不得直接成为仓库 fixture。
- 可提交的结构等价脱敏件固定为 `packages/admin-plugin/test/phoenix-open-issue/fixtures/legacy-import/migration-v1-full.sanitized.json`，SHA-256 为 `4ce585cc6bcf0bf6b2d4057bd6b91d7436ddf7e0689203f40d54a3746099a130`。它保留表结构、行数、协议值和引用关系，但所有 ID、账号、邮箱、组织名、业务文本、功能标识与字典显示名均已替换，密码哈希仅保留不可登录的测试占位符。

## 冻结数据集

| 数据集 | 原表 | 行数 | 目标表 | 处理 |
| --- | --- | ---: | --- | --- |
| 问题列表 | `issueLists` | 4 | `oip_issue_list` | 业务导入 |
| 列表成员 | `issueListMembers` | 6 | `oip_issue_list_member` | 业务导入；用户 ID 必须映射 Host |
| Issue | `issues` | 4 | `oip_issue` | 业务导入；重算 `listCount` |
| Issue 关联 | `issueListLinks` | 7 | `oip_issue_list_link` | 业务导入 |
| 点检 | `checkpoints` | 12 | `oip_checkpoint` | 业务导入 |
| 8D 报告 | `eightDReports` | 3 | `oip_eight_d_report` | 可选导入；独立表优先，缺失可从 Issue 提取，失败不阻断核心业务 |
| 推送 | `pushRecords` | 4 | `oip_push_record` | 业务导入 |
| 功能简表 | `poiFunctions` | 1 | `oip_function` | 业务导入 |
| 用户 | `users` | 4 | Host 用户 | 不导入账号或密码；仅在浏览器本地辅助映射 Host ID |
| 组织 | `orgUnits` | 5 | 不导入 | 明确排除；旧版列表组织字段未被业务界面或权限使用 |
| 字典 | `dict` | 52 | COOL namespaced 字典 | 与业务数据分离，默认排除 |

8 类业务数据合计 41 行。原包另有空的 `externalIdentities`、`externalBindRequests`，不计入排除类数量。

## 只读完整性结论

- 4 个不同 legacy 核心用户引用均能在原包用户集合中找到；维护页使用 Host 公共用户列表，仅在用户名或邮箱唯一精确且命中一致时自动建议，其他情况由管理员显式选择。服务端提交只含 `legacyUserId -> HostUserId`，不含旧账号资料。
- 原包 4 个列表带 3 个不同 `orgUnitId`，但旧版列表 View、编辑表单、筛选、权限和更新服务均未使用该字段；迁移提交统一置空，服务端再次强制置空，不映射或新建组织。
- 列表成员→列表、Issue→列表、关联→Issue/列表、点检→Issue、8D→Issue、推送→Issue 的缺失引用均为 0。
- 各表主 ID、成员 `(listId,userId)`、Issue 编号、关联 `(issueId,listId)`、功能 `(platform,externalId)` 的重复数均为 0。
- 3 个 Issue 的 legacy `containment/rootCause/correctiveAction` 与 3 条独立 8D 报告逐项完全一致；本包保留独立报告，旧 Issue 重复列不再写入。通用规则是独立报告优先；缺少独立表或某个 Issue 缺报告时才从内嵌字段生成确定性可选报告。
- 协议值均落在当前已知集合：列表类型为 `monthly/project`，Issue 状态为 `open/in_progress`，重要度为 `minor/major/fatal`，紧急度为 `medium/high/critical`。
- 真实原文件已通过服务端领域规划器：41 行、4 个用户引用、0 个组织引用，结构阻断为 0；3 个 legacy 列表组织引用作为历史残留报告后移除，3 个超长 8D ID 生成确定性重映射。验证时使用的数字用户 ID 仅为算法占位，不代表 Host 映射已经批准。

## 独立字典预检

旧站 52 行字典已作为独立候选数据集完成只读预检，不属于 41 行业务提交物：

| 旧站分组 | COOL namespaced key | 行数 | 核心保护 |
| --- | --- | ---: | ---: |
| `issueCategory` | `phoenix-open-issue.issueCategory` | 14 | 0 |
| `detectionPhase` | `phoenix-open-issue.detectionPhase` | 11 | 0 |
| `orgUnitType` | `phoenix-open-issue.orgUnitType` | 4 | 0 |
| `severity` | `phoenix-open-issue.severity` | 4 | 4 |
| `priority` | `phoenix-open-issue.priority` | 4 | 4 |
| `closeReason` | `phoenix-open-issue.closeReason` | 6 | 0 |
| `listType` | `phoenix-open-issue.listType` | 9 | 4 |

- 52 行全部启用，`(groupName,value)` 无重复，各组 `sortOrder` 无重复。
- legacy tags 是逗号包裹的字符串：`core=12`、`general=13`、`automotive=8`、`software=29`。
- 当前 Host COOL `dict_info` 只有 `typeId/name/value/orderNum/remark/parentId`（另有基类字段），没有 `enabled`、`tags` 或 `core` 内置属性；`dict_type` 只有 `name/key`（另有基类字段）。
- 因此在 Host 治理升级部署前，tags 只进入预检报告，不能借用 `remark` 冒充结构化语义；核心保护由插件协议白名单执行。

## Host 字典治理冻结方案（尚未实施）

Admin 总控已在只读讨论中冻结以下方向；这不是当前数据库能力，也不授权本插件改 Host：

- 字典二态只增加 `enabled boolean`，不再增加含义重复的 `status`。只有未来出现 `draft/archived` 等多态才另立状态字段。
- `dict_info` 计划增加 `enabled boolean NOT NULL DEFAULT true`、`tags text[] NOT NULL DEFAULT '{}'`、`core boolean NOT NULL DEFAULT false`、`ownerModuleId varchar(128) NULL`；`dict_type` 同增 `ownerModuleId`。Host 已固定 PostgreSQL，tags 使用简单数组，本轮不建 tag 表，也不用另一套字典描述 tags。
- `core` 只表示不可破坏的协议值；权威来自插件 manifest 的 `itemClass='core'`，不能由 legacy `core` tag 或客户端 boolean 决定。`ownerModuleId` 来自 Pah `moduleId`。
- 普通 CRUD 对 core 项禁止删除、改 value、停用及修改受管元数据；显示名/备注是否可改按 manifest 可定制策略。只有 Pah reconcile 内部路径能更新受管元数据。
- Host DDL 保持 `0001` 原字节/校验和不变，另增 `schema/0002-dictionary-governance.sql` 和 version 2；必须经过可信 PostgreSQL 备份与独立 restore drill。系统设置的“字典维护” View 只做 readiness、dry-run、确认 reconcile 与 ledger，绝不执行 `ALTER TABLE`。
- 现有字典 CRUD 路径保持兼容；业务 `data/getValues` 默认忽略停用项，管理 list/page 仍查看全部。前端增加 enabled、tags、core、owner 列和筛选，core 行危险控件禁用并说明原因。
- 52 行后续不是永久排除：Host 0002、Node/Vue 和 Issue manifest policyVersion 部署完成后，升级为独立显式计划，与当前 Host 57 项 catalog 逐项对照。`general/automotive/software` 可成为 tags；legacy `core` tag 仅作证据。未知、重复、owner 冲突或 manifest core 不一致全部阻断。
- 通过标准仍包括：第二次 plan 为 0 写、管理员自定义保留、52 行无 silent skip；执行依旧绑定可信备份与恢复演练。

## 固定安全策略

1. 浏览器先做本地只读预检，原文件不因“选择文件”自动上传。
2. 服务端只接受提取后的 8 类业务数据集；提交物不得包含 `users`、`orgUnits`、`dict` 或密码字段，所有 `issueLists.orgUnitId` 必须被规范为 `null`。
3. 用户必须映射到 Host 稳定 ID；浏览器通过 Host 公共用户列表给出唯一精确建议并允许人工修正，服务端只接受完整的数字 ID 映射，不接收旧账号资料，也不查询 Host 私有用户表。当前一次性迁移由 Root 对约 4 个 legacy 引用逐项确认；组织不映射、不新建、不导入。
4. 当前为少量测试数据的一次性 append + deterministic skip；不提供旧 `replace|merge`，不删除或覆盖目标数据。相同 ID、`issueNo`、`(listId,userId)` 成员、`(issueId,listId)` 链接及 `(platform,externalId)` 功能均视为目标已存在，计划逐条输出表、判重依据、源/目标 ID，保留目标并跳过源行；`issueNo` 命中不同目标 ID 时把待导入链接、点检、推送和 8D 简单改指向现有 Issue，功能命中不同目标 ID 时把 `functionId` 改指向现有功能，不做字段级复杂合并。8D 目标最终 ID 相同，或 `(relatedIssueId, containment, rootCause, correctiveAction)` 规范化后完全一致，同样视为已存在并跳过；同一 Issue 但内容不同不视为同一记录。未来出现大规模迁移需求时再升级严格校验、差异比较和人工冲突处置。
5. 超过目标列长度的 legacy ID 使用冻结算法确定性重映射，并在计划中逐项报告；其余兼容 ID 保持不变。
6. 计划绑定业务数据 SHA、映射 SHA、目标数据库身份和目标冲突快照；执行按钮只有在 Root 人工勾选“已有可恢复的 PostgreSQL 备份”后启用，插件不伪造或自动验证备份/恢复演练。
7. 计划只允许认领一次；Issue/List/Link/点检/推送/功能等核心写入按固定依赖顺序置于同一 PostgreSQL 事务，任何核心写入失败都会回滚整笔核心事务，需重新生成计划后再试。8D 在核心事务提交后使用独立可选事务：无效、已存在、目标通道不可用或插入失败都只形成显式跳过/提示，不回滚核心记录。提交后验收异常由管理员使用已确认的备份恢复。
8. 字典 52 行永远不随 41 行业务数据隐式执行；其独立预检保护 `severity`、`priority` 和核心 `listType` 共 12 个协议项，并报告 namespaced key、排序、停用、tags 和 Host 显示名冲突。核心身份以 manifest 为权威，legacy `core` tag 只作证据。

## 当前状态

本地只读预检、脱敏测试 fixture、用户映射、计划指纹、15 分钟一次认领契约和导入执行算法已进入插件仓。执行器先把确定性重复逐条列出并从待写入集合移除，再以单事务写入剩余核心业务，最后独立尝试可选 8D 事务；8D 插入失败只报告且不回滚已提交核心业务。服务端计划校验核心业务字段、协议、引用、完整数字用户映射、目标 ID/唯一键和目标快照；相同 ID、Issue 编号、成员、链接和功能均简单跳过并按需改指关联，不阻断其他数据；8D 独立处理、可提取、可按 ID/内容签名跳过且不阻断核心业务。计划分别绑定原始包、规范化业务数据、用户映射和目标快照 SHA-256。插件不导入账号、不读写 Host 私有用户表、不生成或验证整库备份。原产品维护页面和 Controller endpoint 已退役；这些算法与 `list-org-references` 幂等规则等待 Host adapter schema 冻结后声明式接入。受控测试清单为 27 文件 / 149 用例。

2026-08-04 本地 Hub/PostgreSQL 实测使用 41 行测试包：首轮计划写入 40 行，核心写入 37 行、按相同 Issue 编号跳过 1 行，可选 8D 写入 3 行；第二轮执行核心写入 0 行、重复跳过 38 行，可选 8D 写入 0 行、已存在跳过 3 行。第二轮没有新增记录，证明当前一次性导入的确定性判重和重复执行幂等正常。
