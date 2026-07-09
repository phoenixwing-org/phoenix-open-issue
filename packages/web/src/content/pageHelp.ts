import type { DriveStep } from "driver.js";

/** 各页帮助内容 */
export type PageHelpContent = {
  title: string;
  bullets: string[];
  /** 可选：本页巡游步骤 */
  tourSteps?: DriveStep[];
};

function step(
  selector: string,
  title: string,
  description: string,
  side: "top" | "right" | "bottom" | "left" = "bottom",
): DriveStep {
  return {
    element: selector,
    popover: { title, description, side, align: "start" },
  };
}

export const PAGE_HELP: Record<string, PageHelpContent> = {
  welcome: {
    title: "欢迎",
    bullets: [
      "首次进入显示欢迎遮罩；点击「进入仪表盘」开始使用。",
      "功能卡片概览：列表管理、Issue 追踪、组织推送。",
      "点击左上角 Logo 可随时重新打开欢迎页。",
    ],
    tourSteps: [
      step("[data-tour='welcome-brand']", "品牌区", "Open Issue List — 汽车行业 IATF 16949 议题追踪系统。"),
      step("[data-tour='welcome-cards']", "功能卡片", "三大核心功能：列表管理、Issue 追踪、组织推送。"),
    ],
  },
  dashboard: {
    title: "仪表盘",
    bullets: [
      "视图切换：👤 我的 / 🌐 所有 / 📦 归档。",
      "卡片显示列表名称、类型标签、成员数、更新时间。",
      "点击卡片进入列表详情；📦 按钮可归档列表。",
      "「新建列表」创建年度/月度/项目/自定义列表。",
      "首次登录会询问是否添加演示数据，选择后可快速体验。",
    ],
    tourSteps: [
      step("[data-tour='dashboard-views']", "视图切换", "👤 我的：自己创建的列表；🌐 所有：全部列表；📦 归档：已归档的列表。"),
      step("[data-tour='dashboard-create']", "新建列表", "创建年度检查计划、月度点检、项目跟踪或自定义个人列表。"),
      step("[data-tour='dashboard-cards']", "列表卡片", "点击卡片进入 Issue 管理页。右上角 📦 图标可归档列表。"),
    ],
  },
  lists: {
    title: "列表管理",
    bullets: [
      "列表总览表格：名称、类型标签、负责人、成员数、Issue 数、更新时间。",
      "点击列表名称进入详情页；可编辑/删除列表。",
      "右上角「+ 新建列表」创建年度/月度/项目/自定义列表。",
    ],
    tourSteps: [
      step("[data-tour='lists-create']", "新建列表", "创建年度检查计划、月度点检、项目跟踪或自定义个人列表。填写名称、类型、描述。"),
      step("[data-tour='lists-table']", "列表总览", "名称可点击进入详情。类型用颜色标签区分。操作栏可编辑/删除列表。"),
    ],
  },
  listDetail: {
    title: "列表详情",
    bullets: [
      "三种视图：📋 简单 / 📋📋 复杂 / 📋📋📋 跟踪（最近点检 + 逾期高亮）。",
      "「列设置」：三种视图分别配置显示列与顺序（本机 localStorage，不改后端 SQL）。",
      "可选列含编号、严重度、分类、发现阶段、功能、提出人、责任人等；「最近点检」仅跟踪视图可选。",
      "8D 报告（D3/D4/D5-D6）不在列设置中：长文本不适合表格，请在详情/编辑中查看与填写。",
      "筛选栏：文本搜索、状态、严重度、分类；勾选「只显示【不关注】」仅看不关注项。",
      "默认排序：关注度降序 → 优先级；关注列可点击表头排序。",
      "列头排序 + 列宽拖拽；标题/编号点击查看详情，操作列图标编辑/推送。",
      "关注列：0=不关注，1~5=关注递增；点击可快速修改。",
      "「成员」管理列表成员与角色权限。",
      "📤 推送 Issue 到其他列表；推送收件箱审批。",
    ],
    tourSteps: [
      step("[data-tour='list-members']", "成员管理", "查看和管理列表成员。owner 可添加/移除成员、转让所有权。角色分 owner/admin/editor/reporter/viewer。"),
      step("[data-tour='list-create-issue']", "新建 Issue", "创建新的问题条目。填写标题、严重度、优先级、分类、发现阶段、责任人等。"),
      step("[data-tour='list-filters']", "筛选栏", "文本搜索标题/描述；按状态、严重度、分类过滤；勾选「显示已作废」查看隐藏项。"),
      step("[data-tour='list-view-toggle']", "视图模式", "📋 简单：日常点检扫视；📋📋 复杂：审计追溯；📋📋📋 跟踪：最近点检时间线。"),
      step("[data-tour='list-table']", "Issue 表格", "点击列头排序；拖拽列边调整宽度；点击行进入 Issue 详情。操作列：状态下拉 + 📤 推送。"),
    ],
  },
  issueDetail: {
    title: "Issue 详情",
    bullets: [
      "基本信息：标题、编号、状态、严重度、优先级、分类、发现阶段。",
      "人员与日期：提出人、责任人、录入人、计划完成日、实际完成日。",
      "关闭信息（已关闭/已取消时显示）：关闭理由、关闭确认人。",
      "8D 报告（填写后显示）：D3 遏制措施、D4 根因分析、D5-D6 纠正措施。",
      "点检时间线：按日期排列，逾期红色高亮，支持标记完成/取消完成。",
      "右上角「编辑」修改字段、「推送」复制到其他列表。",
      "弹窗模式时点击「页面模式」可在独立标签页中打开。",
    ],
    tourSteps: [
      step("[data-tour='issue-meta']", "编号与状态", "可读编号（如 ISS-2026-0001）+ 当前状态标签 + 创建时间。"),
      step("[data-tour='issue-basic']", "基本信息", "严重度、优先级、问题分类、发现阶段 — 汽车行业标准字段。"),
      step("[data-tour='issue-checkpoints']", "点检时间线", "按日期排列的点检记录。逾期红色高亮。可标记完成/取消完成。点击「添加点检」新增。"),
    ],
  },
  org: {
    title: "组织架构",
    bullets: [
      "树形展示组织层级（部 → 科室 → 小组）。",
      "点击节点查看该组织下的成员列表。",
      "仅系统管理员可：新建/编辑组织节点、审批注册用户、调整成员组织与系统权限、禁用/启用用户。",
    ],
  },
  pushHistory: {
    title: "推送历史",
    bullets: [
      "查看所有 Issue 推送记录。",
      "显示推送来源、目标、时间、状态（待审批/已接受/已拒绝）。",
      "支持接受/拒绝待审批推送。",
    ],
  },
  functions: {
    title: "功能表",
    bullets: [
      "管理所有功能/特性条目（来自不同平台的导入数据）。",
      "支持 XLSX 文件导入，自动识别中英文列名（平台/id/功能 等）。",
      "导入时 (平台 + 外部 ID) 联合去重，已存在则更新，否则新增。",
      "导出为 JSON 格式，可用于备份或迁移。",
      "Issue 可关联功能条目，列表和详情中显示关联的功能名。",
    ],
  },
  settings: {
    title: "设置",
    bullets: [
      "📚 数据字典：管理系统下拉选项（问题分类、发现阶段、严重度等）。",
      "可追加汽车/软件行业预设值；按标签批量删除一类值。",
      "🔑 修改密码 / 💾 数据备份（导出为 JSON、导入替换或合并）。",
      "🔧 数据库修正：补全表结构/点检列/链接/字典/用户权限/Issue编号去重，可逐项或全部执行。",
    ],
    tourSteps: [
      step("[data-tour='settings-dict-toolbar']", "字典操作栏", "🚗 汽车预设 / 💻 软件预设：一键追加行业标准值。「+ 添加」新增选项。「🗑 删除一类值」按标签批量删除。"),
    ],
  },
  testRunner: {
    title: "单元测试",
    bullets: [
      "系统管理员可在本页触发后台 Vitest 全量运行（`pnpm test` 等价）。",
      "列表展示当前纳入的测试文件与用例数；点击「全部运行」执行。",
      "运行完成后点击「查看 HTML 报告」在新浏览器标签页打开独立报告，不在应用内嵌显示。",
      "仅开发/内网环境可用（需安装 node_modules/vitest）。",
    ],
  },
};
