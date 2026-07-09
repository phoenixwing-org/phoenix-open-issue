# IssueListLink 关注系数改造

## 1. 背景与动机

`issueListLinks` 表描述 **Issue 与列表的多对多链接**（推送、跨列表引用等）。原设计用布尔字段 `voided` 表示「在本列表作废/隐藏」：

| voided | 含义 |
|--------|------|
| 0 | 正常显示 |
| 1 | 已作废（列表默认隐藏，勾选「显示已作废」才可见） |

该模型只能表达「看 / 不看」，无法表达 **关注程度**。业务上希望：

- **0**：不关注（等价于原「作废」，列表默认不展示）
- **1～5**：关注级别递增（低 → 高，可用于排序高亮、筛选、后续统计）

## 2. 可行性结论

**可行**，理由如下：

1. **数据模型**：SQLite `INTEGER 0~5` 完全满足；原 `voided` 可无损映射（`1→0`，`0→3`）。
2. **影响范围可控**：约 15 处后端引用、列表详情页 UI、备份/修正逻辑；无跨服务依赖。
3. **兼容策略**：保留 `PATCH .../void` / `unvoid` 作为快捷 API（分别设为 0 / 3）；查询参数 `includeVoided` 保留，语义改为「包含不关注(0)」。
4. **迁移风险低**：启动时 +「数据库修正」双通道执行同一迁移函数，幂等。

### 需注意

- Issue **计数**（列表卡片 `issueCount`）应只统计 `attentionLevel > 0` 的链接。
- 同一 Issue 在不同列表可有 **不同关注级别**（链接级属性，符合多列表语义）。
- 旧列 `voided` / `voidedAt` / `voidedBy` 迁移后可保留在库中（SQLite 删列成本高），代码不再读写；可选后续 rebuild 清理。

## 3. 字段设计

### 3.1 新字段（替代 voided 系列）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `attentionLevel` | INTEGER | 3 | 0=不关注，1~5=关注递增；CHECK 0~5 |
| `attentionUpdatedAt` | TEXT | NULL | 最后一次调整关注级别的时间 |
| `attentionUpdatedBy` | TEXT | NULL | 操作人 userId |

### 3.2 级别语义（建议）

| 值 | 标签 | 说明 |
|----|------|------|
| 0 | 不关注 | 列表默认隐藏；等同原「作废」 |
| 1 | 一星 | 最低关注 |
| 2 | 二星 | 较低 |
| 3 | 三星 | **默认**（新建链接、原 voided=0 迁移值） |
| 4 | 四星 | 较高 |
| 5 | 五星 | 重点跟踪 |

### 3.3 迁移映射

```
voided = 1  →  attentionLevel = 0
voided = 0  →  attentionLevel = 3
voidedAt    →  attentionUpdatedAt
voidedBy    →  attentionUpdatedBy
```

## 4. API 变更

### 4.1 新增（推荐）

```
PATCH /list/:listId/issue/:issueId/attention
Body: { "attentionLevel": 0..5 }
```

### 4.2 保留兼容

| 旧 API | 新语义 |
|--------|--------|
| `PATCH .../void` | 设置 `attentionLevel = 0` |
| `PATCH .../unvoid` | 设置 `attentionLevel = 3` |
| `GET .../issues?includeVoided=true` | 包含 `attentionLevel = 0` 的链接 |

### 4.3 列表 Issue 响应

每条 Issue 增加（或替换）：

```json
{
  "_attentionLevel": 3
}
```

`_voided` 可保留一版本为 `_attentionLevel === 0` 的派生（前端过渡期），后续移除。

## 5. UI 变更（列表详情）

| 原 | 新 |
|----|-----|
| 「显示已作废」 | 「显示不关注」 |
| 「作废 / 恢复」 | 关注级别下拉（0~5 或快捷：不关注 / 恢复默认三星） |
| 作废行半透明 | `attentionLevel === 0` 半透明；4~5 可选高亮 |

## 6. 数据库修正

**设置 → 数据库修正 → 链接关注系数迁移**

或启动时自动执行（`systemFlags.migrate_link_attentionLevel`）。

步骤：

1. `ADD COLUMN attentionLevel`（若不存在）
2. `ADD COLUMN attentionUpdatedAt / attentionUpdatedBy`（若不存在）
3. 从 `voided*` 回填数据
4. 校验：所有链接 `attentionLevel BETWEEN 0 AND 5`

## 7. 实施计划

### 阶段 A — 数据层（本次）

- [x] 文档与方案（本文）
- [x] `core` 类型：`AttentionLevel`、`ATTENTION_LEVEL_LABELS`
- [x] `schema.ts` 新库建表用新字段
- [x] `migrations.ts` + 启动迁移
- [x] `DbRepairService.repairLinkAttention()`
- [x] 后端 Service / Controller 改用 `attentionLevel`
- [x] 兼容 void/unvoid API

### 阶段 B — 前端

- [x] 列表详情：关注级别列 / 下拉
- [x] 筛选「显示不关注」
- [ ] `pageHelp` / 使用手册全文更新

### 阶段 C — 增强（可选）

- [ ] 按关注级别排序 / 筛选
- [ ] 仪表盘「重点 Issue」(level≥4)
- [ ] 删除废弃列（SQLite 表重建）

## 8. 涉及文件清单

| 层 | 文件 |
|----|------|
| 文档 | `doc/IssueListLink关注系数.md`、`doc/使用手册.md`、`doc/API参考.md` |
| Core | `packages/core/src/types/issue.ts` |
| DB | `schema.ts`、`migrations.ts` |
| Server | `IssueService.ts`、`IssueListService.ts`、`BackupService.ts`、`DbRepairService.ts`、`IssueController.ts`、`routes/index.ts` |
| Web | `ListDetailView.vue`、`api/issues.ts`、`stores/issues.ts`、`pageHelp.ts` |

## 9. 测试要点

1. 旧库启动后 `voided=1` 的行变为 `attentionLevel=0`，列表默认不可见
2. 「显示不关注」可看到 level=0 的行
3. 设置 level 5 后刷新仍保持
4. void/unvoid 快捷操作仍有效
5. 数据库修正任务可重复执行且无报错
6. 新建 Issue 链接默认 level=3
