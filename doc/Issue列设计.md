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
| 8 | 计划完成日 | `dueDate` | DATE (YYYY-MM-DD) | deadline |
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
| `in_progress` | 进行中 | 🟡 黄 | 正在处理 |
| `resolved` | 已解决 | 🟢 绿 | 已完成，待确认关闭 |
| `closed` | 已关闭 | 🔵 蓝 | 确认关闭 |
| `cancelled` | 已取消 | ⚫ 深灰 | 不再需要处理 |

**状态流转规则**（参考 IATF 16949 问题管理流程）：
```
open → in_progress → resolved → closed
  ↓         ↓           ↓
cancelled cancelled  cancelled
```
- `resolved` 转为 `closed` 时须填写 `closeReason` 和 `closedBy`
- `closed` 和 `cancelled` 为终态，不可再流转（未来可加 reopen）

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

**Checkpoint 不变**，仍然是 Issue 下的时间线节点。新增字段是 Issue 层面的属性元数据。

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
├── containment      ← 新增 (D3)
├── rootCause        ← 新增 (D4)
├── correctiveAction ← 新增 (D5-D6)
└── Checkpoints (时间线节点 — 不变)
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
dueDate           TEXT     计划完成日 (YYYY-MM-DD)
completedAt       TEXT     实际完成时间
closeReason       ENUM     completed | cancelled | duplicate | transferred | unreproducible
closedBy          TEXT     关闭确认人 FK→users
sortOrder         INTEGER  排序
createdBy         TEXT     录入人
createdAt         TEXT     创建时间
updatedAt         TEXT     更新时间
```

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
| `dueDate` | 计划完成日 | |
| `attention` | 关注度 | 列表级（`issueListLinks.attentionLevel`） |
| `status` | 状态 | |
| `createdAt` | 创建日期 | |

### 仅跟踪视图可选

| 列 key | 中文 | 说明 |
|--------|------|------|
| `checkpoints` | 最近点检 | 展示最近 N 条点检摘要；N 由设置中的「显示最近条数」控制 |

### 8D 字段**不**纳入列设置（设计决策）

以下三个 8D 报告字段**有意不提供**为列表可选列：

| 字段 | 8D 步骤 | 展示位置 |
|------|---------|----------|
| `containment` | D3 临时遏制 | Issue 详情 / 编辑弹窗 |
| `rootCause` | D4 根本原因 | Issue 详情 / 编辑弹窗 |
| `correctiveAction` | D5-D6 纠正措施 | Issue 详情 / 编辑弹窗 |

**原因：**

1. **长文本不适合表格** — 三列均为多行 textarea 内容，在列表中只能截断显示，可读性差，且会显著拉宽表格。
2. **使用场景偏「深读/编辑」** — 列表页用于快速扫视状态、责任人、优先级等结构化字段；8D 内容适合在详情页或编辑弹窗中完整阅读与撰写。
3. **与同类字段一致** — `description`（描述）同样未列入可选列，8D 三字段与描述同属正文类长文本。
4. **无后端代价差异** — 即便未来加入列表列，数据已在 `SELECT i.*` 中返回，仍只是展示层问题；当前产品选择是**默认不在列表暴露**，避免误用。

若后续需要「列表一眼看 8D 进度」，可考虑单独增加一列 **8D 进度**（如：未填 / 部分 / 已完成），而非三列长文本——该方案尚未实现。
