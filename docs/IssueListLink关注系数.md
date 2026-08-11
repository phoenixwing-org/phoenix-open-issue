# IssueListLink 关注系数

## 1. 背景

`issueListLinks` 表描述 **Issue 与列表的多对多链接**（推送、跨列表引用等）。

早期用 `voided` / `voidedAt` / `voidedBy` 表示「在本列表隐藏」。现已统一为 **关注系数 `attentionLevel`（0~5）**：

| 值 | 标签 | 说明 |
|----|------|------|
| 0 | 不关注 | 列表默认隐藏（前端勾选「只显示【不关注】」才单独查看） |
| 1~5 | 一星~五星 | 关注递增；新建链接默认 **3（三星）** |

同一 Issue 在不同列表可有 **不同关注级别**（链接级属性）。

## 2. 当前字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `attentionLevel` | INTEGER 0~5 | 关注系数 |
| `attentionUpdatedAt` | TEXT | 最后调整时间 |
| `attentionUpdatedBy` | TEXT | 操作人 userId |
| `linkedAt` / `linkedBy` | | 链接创建信息 |

**已废弃并删除**（迁移后表重建移除）：`voided`、`voidedAt`、`voidedBy`。

## 3. API

```
PATCH /list/:listId/issue/:issueId/attention
Body: { "attentionLevel": 0..5 }
```

列表 Issue 响应附带：

```json
{ "_attentionLevel": 3 }
```

`GET /list/:listId/issues` **不再**按不关注过滤，返回该列表全部链接；是否显示 level=0 由 **前端**「只显示【不关注】」勾选控制（勾选后**仅显示**不关注项）。

## 4. UI

| 场景 | 行为 |
|------|------|
| 列表关注列 | 文字标签（不关注 / 一星 … 五星），点击快速编辑 |
| 快速编辑 / 编辑 Issue | `AttentionStars` 五星控件，可设为 0 |
| 「只显示【不关注】」 | 纯前端筛选，不触发重新请求 |
| 更多 → 设为不关注 | `PATCH .../attention` `{ attentionLevel: 0 }` |
| 更多 → 恢复默认三星 | `{ attentionLevel: 3 }` |

## 5. 数据库迁移

**设置 → 数据库修正 → 链接关注系数迁移**，或应用启动时自动执行（`systemFlags.migrate_link_attentionLevel`）。

步骤（幂等）：

1. 若旧库存在 `voided*` 列：回填 `attentionLevel` / `attentionUpdatedAt` / `attentionUpdatedBy`
   - `voided=1 → 0`，`voided=0 → 3`
2. 归一非法 `attentionLevel` 为 0~5
3. **重建 `issueListLinks` 表，删除 `voided` / `voidedAt` / `voidedBy`**
4. 已迁移但尚未删列的库：下次启动会自动补跑删列

新库建表仅含 `attentionLevel` 系列，不再创建 `voided*` 列。

## 6. Issue 计数

列表卡片 `issueCount`、备份/修正逻辑均只统计 **`attentionLevel > 0`** 的链接。

## 7. 涉及文件

| 层 | 文件 |
|----|------|
| Core | `packages/core/src/types/attention.ts` |
| DB | `schema.ts`、`migrations.ts`（`migrateIssueListLinkAttention`、`dropIssueListLinkVoidedColumns`） |
| Server | `IssueService.ts`、`IssueListService.ts`、`BackupService.ts`、`DbRepairService.ts` |
| Web | `ListDetailView.vue`、`AttentionStars.vue`、`api/issues.ts`、`stores/issues.ts` |

## 8. 测试要点

1. 旧库启动后 level=0 的行默认不可见，勾选「只显示【不关注】」可单独查看
2. 五星弹窗可设 1~5，可清零为不关注
3. 设置 level 5 后刷新仍保持
4. 数据库修正可重复执行；执行后 `PRAGMA table_info(issueListLinks)` 无 voided 列
5. 新建 Issue 链接默认 level=3
