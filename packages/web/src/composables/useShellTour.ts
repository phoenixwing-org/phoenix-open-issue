import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const SHELL_TOUR_STEPS: DriveStep[] = [
  {
    element: "[data-tour='ribbon-area']",
    popover: {
      title: "Ribbon 工具栏",
      description: "Issue Tab 包含仪表盘、列表管理等常用功能入口。点击按钮打开对应页面。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='shell-main']",
    popover: {
      title: "主内容区",
      description: "当前页面在这里显示。支持多 Tab 切换，点击顶栏 Tab 标签可切换已打开的页面。",
      side: "top",
      align: "center",
    },
  },
  {
    element: "[data-tour='shell-status']",
    popover: {
      title: "状态栏",
      description: "底部显示当前页面名称；点击可展开运行日志面板。",
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
