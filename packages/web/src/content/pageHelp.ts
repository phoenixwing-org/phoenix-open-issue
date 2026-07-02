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
      "首次进入显示欢迎遮罩；点击「打开仪表盘」进入工作台。",
      "功能卡片概览：列表管理、Issue 追踪、组织推送。",
      "左侧「返回工作台」关闭遮罩回到已有页面。",
    ],
    tourSteps: [
      step("[data-tour='welcome-brand']", "品牌区", "应用名称与技术栈信息。"),
      step("[data-tour='welcome-cards']", "功能卡片", "三大核心功能的快速入口说明。"),
    ],
  },
  dashboard: {
    title: "仪表盘",
    bullets: [
      "视图切换：👤 我的 / 🌐 所有 / 📦 归档。",
      "卡片显示列表名称、类型、成员数、更新时间。",
      "点击卡片进入列表详情；📦 按钮可归档列表。",
      "右上角「新建列表」创建年度/月度/项目/自定义列表。",
      "「创建演示数据」一键生成示例 Issue。",
    ],
    tourSteps: [
      step("[data-tour='dashboard-views']", "视图切换", "切换查看自己创建的、所有的或已归档的列表。"),
      step("[data-tour='dashboard-cards']", "列表卡片", "点击卡片进入该列表的 Issue 管理页。"),
    ],
  },
  lists: {
    title: "列表管理",
    bullets: [
      "三种视图：📋 简单（点检扫视）/ 📋📋 复杂（审计追溯）/ 📋📋📋 跟踪（最近点检）。",
      "支持按严重度、优先级、状态、责任人筛选排序。",
      "「+ 新建 Issue」创建新议题；点击行进入详情。",
      "「成员」按钮管理列表成员与权限。",
    ],
    tourSteps: [
      step("[data-tour='list-views']", "视图切换", "不同视图适用于点检会议、审计追溯、跟踪讨论等场景。"),
      step("[data-tour='list-table']", "Issue 表格", "可点击列头排序，使用上方筛选栏缩小范围。"),
    ],
  },
  issueDetail: {
    title: "Issue 详情",
    bullets: [
      "21 个汽车行业标准字段：严重度、优先级、发现阶段、责任人等。",
      "时间线点检：每个 Issue 可添加多条点检记录。",
      "支持编辑字段、添加点检、查看推送状态。",
    ],
  },
  org: {
    title: "组织架构",
    bullets: [
      "树形展示组织层级（公司 → 部门 → 科室 → 小组）。",
      "查看各节点的成员列表。",
      "推送 Issue 时按组织层级选择目标。",
    ],
  },
  pushHistory: {
    title: "推送历史",
    bullets: [
      "查看所有 Issue 推送记录。",
      "显示推送来源、目标、时间、状态。",
      "支持覆盖/合并两种推送策略。",
    ],
  },
  settings: {
    title: "设置",
    bullets: [
      "用户偏好与系统配置（待实现）。",
      "可通过工具栏右侧或 Ribbon「系统」Tab 进入。",
    ],
  },
};
