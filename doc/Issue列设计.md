# Issue 列设计

> 汽车行业 Open Issue List 参考 IATF 16949 / 8D 报告标准，对标当前 v0.1 原型列，设计完整扩展方案。

---

## 最终列定义（v0.2+ 已实现）

### 第一层：基本信息

| # | 中文 | 字段名 | 类型 | 展示 | 说明 |
|---|------|--------|------|------|------|
| 1 | 问题编号 | `issueNo` | TEXT | `ISS-2026-0001` | 可读编号，按列表+年度自增 |
| 2 | 标题 | `title` | TEXT | 单行文本 | 必填 |
| 3 | 描述 | `description` | TEXT | 多行文本 | 可选 |

### 第二层：人员与日期

| # | 中文 | 字段名 | 类型 | 说明 |
|---|------|--------|------|------|
| 4 | 提出人 | `reporterId` | FK→users | 谁发现/提出的（区分于 createdBy） |
| 5 | 责任人 | `assigneeId` | FK→users | 谁负责解决 |
| 6 | 录入人 | `createdBy` | FK→users | 谁录入系统 |
| 7 | 创建日期 | `createdAt` | DATETIME | 系统自动记录 |
| 8 | 截止日 | `dueDate` | DATE (YYYY-MM-DD) | deadline |
| 9 | 实际完成日 | `completedAt` | DATETIME | 状态变为 resolved/closed 时自动记录 |

### 第三层：状态与关闭

| # | 中文 | 字段名 | 类型 | 枚举值 | 说明 |
|---|------|--------|------|--------|------|
| 10 | 状态 | `status` | ENUM | `open` `in_progress` `resolved` `closed` `cancelled` | 彩色标签 |
| 11 | 优先级 | `priority` | ENUM | `low` `medium` `high` `critical` | — |
| 12 | 关闭理由 | `closeReason` | ENUM | `completed` `cancelled` `duplicate` `transferred` `unreproducible` | 灰色标签 |
| 13 | 关闭确认人 | `closedBy` | FK→users | — | 谁点了关闭 |

### 第四层：严重度与分类（IATF 16949 标准）

| # | 中文 | 字段名 | 类型 | 枚举值 | IATF 16949 参考 |
|---|------|--------|------|--------|-----------------|
| 14 | 严重度 | `severity` | ENUM | 见下方详细定义 | 参考 FMEA 严重度等级 |
| 15 | 问题分类 | `category` | ENUM | 见下方详细定义 | 参考 IATF 16949 缺陷分类 |
| 16 | 发现阶段 | `detectionPhase` | ENUM | 见下方详细定义 | 参考 AIAG 检测来源 |

### 第五层：8D 报告字段

| # | 中文 | 字段名 | 类型 | 8D 步骤 | 说明 |
|---|------|--------|------|---------|------|
| 17 | 临时遏制措施 | `containment` | TEXT | D3 | 临时围堵/遏制措施描述 |
| 18 | 根本原因 | `rootCause` | TEXT | D4 | 根本原因分析结果 |
| 19 | 永久纠正措施 | `correctiveAction` | TEXT | D5-D6 | 永久纠正/预防措施 |

### 元数据

| # | 中文 | 字段名 | 类型 | 说明 |
|---|------|--------|------|------|
| 20 | 排序 | `sortOrder` | INTEGER | 列表内拖拽排序 |
| 21 | 更新时间 | `updatedAt` | DATETIME | 系统自动记录 |

---

## 枚举详细定义

### IssueStatus — 状态

| 值 | 中文 | 图标颜色 | 说明 |
|----|------|---------|------|
| `open` | 待处理 | ⚪ 灰 | 新建未开始 |
| `in_progress` | 处理中 | 🟡 黄 | 正在处理 |
| `resolved` | 待验收 | 🟢 绿 | 处理完成，等待确认 |
| `closed` | 已完成 | 🔵 蓝 | 验收通过，处理结束 |
| `cancelled` | 已取消 | ⚫ 深灰 | 不再需要处理 |

**推荐状态流转**（参考 IATF 16949 问题管理流程）：
```
open → in_progress → resolved → closed
  ↓         ↓           ↓
cancelled cancelled  cancelled
```
- `resolved` 表示处理完成但尚待确认；`closed` 表示验收通过；`cancelled` 表示无需继续处理。
- `closed` 和 `cancelled` 是业务终态。当前快捷编辑仍允许管理员或有编辑权限的成员修正误选状态。

### IssuePriority — 优先级

| 值 | 中文 | 参考标准 |
|----|------|---------|
| `low` | 低 | 影响有限，无紧急要求 |
| `medium` | 中 | 一般影响，常规处理 |
| `high` | 高 | 显著影响，需优先处理 |
| `critical` | 紧急 | 严重影响/安全问题，立即处理 |

### Severity — 严重度（IATF 16949 FMEA 风格）

| 值 | 中文 | 标签颜色 | 定义 | FMEA 严重度参考 |
|----|------|---------|------|----------------|
| `fatal` | 致命 🔴 | 红色 | 涉及安全/法规/停线，导致产品无法使用 | S=9-10 |
| `major` | 严重 🟠 | 橙色 | 核心功能丧失，客户强烈不满 | S=7-8 |
| `minor` | 一般 🟡 | 黄色 | 部分功能受影响，有降级方案 | S=4-6 |
| `trivial` | 轻微 🟢 | 绿色 | 外观/体验瑕疵，不影响功能 | S=1-3 |

### IssueCategory — 问题分类（IATF 16949 缺陷分类惯例）

| 值 | 中文 | 说明 | 典型场景 |
|----|------|------|---------|
| `appearance` | 外观 | 表面/外观缺陷 | 划痕、色差、毛刺 |
| `dimension` | 尺寸 | 尺寸/公差偏差 | 超差、配合不良 |
| `function` | 功能 | 功能/性能失效 | 不工作、性能不达标 |
| `process` | 过程 | 过程/流程问题 | 流程缺失、执行偏差 |
| `safety` | 安全 | 安全隐患 | 安全相关项（须走安全审批） |
| `other` | 其他 | 不在上述分类中 | 自定义 |

### DetectionPhase — 发现阶段（AIAG / IATF 16949 检测来源）

| 值 | 中文 | 说明 | 典型场景 |
|----|------|------|---------|
| `incoming` | 来料检验 | IQC / 供应商来料检测 | 原材料/外购件入库检查 |
| `in_process` | 过程检验 | 制造过程/IPQC 检测 | 首件检验、巡检、自检 |
| `final` | 终检/出厂 | 成品出厂检验 OQC | 发货前最终检查 |
| `customer` | 客户反馈 | 客户/0公里/售后发现 | 0公里 PDI、售后投诉、客诉 |
| `audit` | 审核发现 | 内部/外部审核 | 内审、外审、过程审核 VDA 6.3 |
| `supplier` | 供应商端 | 供应商处发现 | 供应商过程异常、SQE 发现 |

### CloseReason — 关闭理由

| 值 | 中文 | 说明 |
|----|------|------|
| `completed` | 已完成 | 问题已解决，措施有效 |
| `cancelled` | 已取消 | 不再需要处理 |
| `duplicate` | 重复 | 与其他问题重复 |
| `transferred` | 已转交 | 转至其他列表/部门处理 |
| `unreproducible` | 不可复现 | 无法复现，暂关闭 |

---

## 与 Checkpoint 点检的关系

本文原始范围是 Issue 层面的属性元数据。Checkpoint 仍是 Issue 下的时间线节点；其 v0.6.1 日期语义已独立演进为“点检日 + 可选截止日”，当前契约见[点检日期设计](点检日期设计.md)。

```
Issue (属性元数据 — 本次新增列)
├── issueNo          ← 新增
├── reporterId       ← 新增
├── assigneeId       ← 新增
├── dueDate          ← 新增
├── completedAt      ← 新增
├── closeReason      ← 新增
├── severity         ← 新增
├── category         ← 新增 (v0.3)
├── detectionPhase   ← 新增 (v0.3)
├── extensions       ← 通用 JSONB 扩展属性（不保存附属关系）
├── listCount        ← 固化的关联点检表数量
└── Checkpoints (时间线节点；当前日期契约另见点检日期设计)
    ├── 2026-06-24: 已走流程到采购 ✅
    ├── 2026-06-28: 和乙方签订合同 ⏳
    └── 2026-07-05: 设备到货验收 📅
```

---

## 实施记录

### v0.2（已实现）

```
issueNo           TEXT     可读编号 ISS-YYYY-NNNN（按列表+年度自增）
title             TEXT     标题
description       TEXT     描述
status            ENUM     open | in_progress | resolved | closed | cancelled
priority          ENUM     low | medium | high | critical
severity          ENUM     fatal | major | minor | trivial
reporterId        TEXT     提出人 FK→users
assigneeId        TEXT     责任人 FK→users
dueDate           TEXT     截止日 (YYYY-MM-DD)
completedAt       TEXT     实际完成时间
closeReason       ENUM     completed | cancelled | duplicate | transferred | unreproducible
closedBy          TEXT     关闭确认人 FK→users
sortOrder         INTEGER  排序
createdBy         TEXT     录入人
createdAt         TEXT     创建时间
updatedAt         TEXT     更新时间
extensions        JSONB    通用扩展属性，NOT NULL DEFAULT '{}'
listCount         INTEGER  关联点检表数量，NOT NULL DEFAULT 0
```

`listCount` 是由 `issueListLinks` 触发器维护的 counter cache。列表和 Issue 详情直接读取该列，不在高频查询中逐行关联统计；备份导入与数据库修正会按关联表重新校正。`extensions` 与它保持独立，禁止把计数或附属关系塞入 JSONB。

### v0.3（已实现）

```
category          ENUM     appearance | dimension | function | process | safety | other
detectionPhase    ENUM     incoming | in_process | final | customer | audit | supplier
containment       TEXT     D3 临时遏制措施
rootCause         TEXT     D4 根本原因
correctiveAction  TEXT     D5-D6 永久纠正措施
```

### 未来可选扩展

```
verificationMethod  TEXT     D7 效果验证方法
preventionAction    TEXT     D7 预防再发生措施
costOfQuality       TEXT     质量成本（内部失败/外部失败）
linkedIssues        TEXT     关联 Issue ID 列表
attachmentUrls      TEXT     附件链接（JSON 数组）
```

---

## 展示格式设计（待前端实现）

### 简单表格（默认，快速浏览）

```
┌──────┬──────────┬────────┬────────┬──────────┬────────┬────────┬──────────┐
│ 编号  │ 标题     │ 提出人  │ 责任人  │ 计划完成  │ 状态   │ 严重度  │ 分类     │
├──────┼──────────┼────────┼────────┼──────────┼────────┼────────┼──────────┤
│0001  │ 采购服务器│ 张三   │ 李四   │ 07-15    │ 🟡进行 │ 🟠严重  │ 过程     │
│0002  │ 部署 CI  │ 王五   │ 赵六   │ 07-20    │ ⚪待处 │ 🔴致命  │ 功能     │
│0003  │ 代码审查  │ 李四   │ —      │ 08-01    │ 🟢已解 │ 🟡一般  │ 过程     │
└──────┴──────────┴────────┴────────┴──────────┴────────┴────────┴──────────┘
```

### 状态图标映射

| 图标 | 含义 |
|------|------|
| ✅ | done 已完成 |
| ⏳ | pending 且未逾期 |
| ⚠️ | pending 且已逾期（红底高亮） |
| 📅 | 未来日期的点检计划 |
| ❌ | skipped 已跳过 |

---

## 列表列设置（前端可配置）

列表详情页提供 **列设置** 对话框：简单 / 复杂 / 跟踪 三种视图**分别**配置显示列与顺序，配置保存在浏览器 `localStorage`（`open-issue-settings.issueListColumns`），**不影响后端 SQL 查询**——接口仍返回完整 Issue 记录，仅前端决定渲染哪些列。

### 固定列（不可配置）

| 列 | 说明 |
|----|------|
| `#` | 行序号 |
| 标题 | 固定左侧，点击打开 Issue 详情 |
| 操作 | 固定右侧（查看 / 编辑 / 推送 / 更多） |

### 可选列（三种视图均可勾选，默认显隐因视图而异）

| 列 key | 中文 | 说明 |
|--------|------|------|
| `issueNo` | 编号 | |
| `severity` | 严重度 | |
| `priority` | 优先级 | |
| `category` | 分类 | |
| `detectionPhase` | 发现阶段 | |
| `function` | 关联功能 | |
| `reporter` | 提出人 | |
| `assignee` | 责任人 | |
| `dueDate` | 截止日 | |
| `attention` | 关注度 | 列表级（`issueListLinks.attentionLevel`） |
| `status` | 状态 | |
| `createdAt` | 创建日期 | |

### 仅跟踪视图可选

| 列 key | 中文 | 说明 |
|--------|------|------|
| `checkpoints` | 最近点检 | 展示最近 N 条点检摘要；N 由设置中的「显示最近条数」控制 |

### 8D 报告**不**纳入 Issue 列设置（0.6.1 决策）

以下三个长文本已从 Issue Core 类型和编辑表单移出，保存于独立 `eightDReports` 附属表，因此**不提供**为 Issue 列表可选列：

| 字段 | 8D 步骤 | 展示位置 |
|------|---------|----------|
| `containment` | D3 临时遏制 | 8D 报告页 / Issue 详情的关联报告 |
| `rootCause` | D4 根本原因 | 8D 报告页 / Issue 详情的关联报告 |
| `correctiveAction` | D5-D6 纠正措施 | 8D 报告页 / Issue 详情的关联报告 |

**原因：**

1. **长文本不适合表格** — 三列均为多行 textarea 内容，在列表中只能截断显示，可读性差，且会显著拉宽表格。
2. **使用场景偏「深读/编辑」** — 列表页用于快速扫视状态、责任人、重要度和紧急度等结构化字段；8D 内容适合在报告页或 Issue 详情的关联报告区完整阅读与撰写。
3. **专业能力可选** — 周点检、例会、开发/测试等通用场景不应被迫携带 8D 专业字段。
4. **核心模型稳定** — `eightDReports.relatedIssueId` 可空；报告可以独立存在，也可多份引用同一 Issue。旧 Issue 表三列只为回滚兼容保留，应用不再写入。

若后续需要「列表一眼看 8D 进度」，可考虑单独增加一列 **8D 进度**（如：未填 / 部分 / 已完成），而非三列长文本——该方案尚未实现。
