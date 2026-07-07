import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const SHELL_TOUR_STEPS: DriveStep[] = [
  {
    element: "[data-tour='ribbon-tabbar']",
    popover: {
      title: "Ribbon 功能切换",
      description: "Issue 模块（仪表盘、列表管理、推送历史）和 系统模块（组织架构、设置）的切换入口。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='ribbon-area']",
    popover: {
      title: "Ribbon 快捷操作",
      description: "当前模块下的常用功能按钮。Issue 模块可快速进入仪表盘、列表管理；系统模块可进入组织架构、设置。",
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
      description: "所有页面内容在此显示。支持左右分栏、表格操作、表单填写等功能。右上角 ? 按钮可查看当前页面帮助。",
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
