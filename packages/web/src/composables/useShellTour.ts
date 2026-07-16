import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const SHELL_TOUR_STEPS: DriveStep[] = [
  {
    element: "[data-tour='ribbon-tabbar']",
    popover: {
      title: "Ribbon 功能切换",
      description: "Issue 模块包含仪表盘、列表管理、推送历史；系统模块包含组织架构、功能表、单元测试和设置。实际可用操作仍受当前账号权限限制。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='ribbon-area']",
    popover: {
      title: "Ribbon 快捷操作",
      description: "当前模块下的页面入口。点击会在工作台打开或切换标签；Ribbon 可用右上角箭头折叠，页面内容不会丢失。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='workbench-tabs']",
    popover: {
      title: "工作台标签栏",
      description: "已打开的页面以标签形式显示。点击标签切换页面，点击 ✕ 关闭。关闭全部标签后自动回到仪表盘。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='shell-main']",
    popover: {
      title: "主内容区",
      description: "所有页面内容在此显示。右上角 ? 可查看文字帮助；点击「本页导引」会自动跳过当前权限或当前标签下不可见的步骤。",
      side: "top",
      align: "center",
    },
  },
  {
    element: "[data-tour='shell-status']",
    popover: {
      title: "状态栏",
      description: "底部显示当前页面名称；点击可展开运行日志面板，查看系统操作记录。",
      side: "top",
      align: "end",
    },
  },
];

export function runShellTour() {
  const d = driver({
    showProgress: true,
    progressText: "{{current}} / {{total}}",
    nextBtnText: "下一步",
    prevBtnText: "上一步",
    doneBtnText: "完成",
    steps: SHELL_TOUR_STEPS,
  });
  d.drive();
}
