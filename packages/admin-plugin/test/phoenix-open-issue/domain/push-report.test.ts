import { describe, expect, it } from "vitest";
import { normalizeEightDReportInput } from "../../../midway/phoenix-open-issue/domain/eight-d-report";
import {
  normalizeDashboardLimit,
  normalizeDashboardScope,
  normalizePushAction,
  normalizePushInput,
} from "../../../midway/phoenix-open-issue/domain/push";

describe("Open Issue 8D 报告领域算法", () => {
  it("保留 legacy 字段并规范空白", () => {
    expect(
      normalizeEightDReportInput({
        relatedIssueId: " issue-1 ",
        title: "  来料异常 8D  ",
        containment: "  先隔离  ",
      })
    ).toEqual({
      relatedIssueId: "issue-1",
      title: "来料异常 8D",
      containment: "先隔离",
      rootCause: "",
      correctiveAction: "",
    });
    expect(() => normalizeEightDReportInput({ title: "" })).toThrow("标题");
  });
});

describe("Open Issue 推送领域算法", () => {
  it("兼容省略 targetType 的 legacy 列表推送并去重 Issue", () => {
    expect(
      normalizePushInput({
        fromListId: "from",
        toListId: "to",
        issueIds: ["a", "a", "b"],
        note: "  复核  ",
      })
    ).toEqual({
      fromListId: "from",
      targetType: "list",
      toListId: "to",
      toUserId: null,
      issueIds: ["a", "b"],
      note: "复核",
    });
  });

  it("校验用户推送、处理动作与待办查询边界", () => {
    expect(
      normalizePushInput({
        fromListId: "from",
        targetType: "user",
        toUserId: "2",
        issueIds: ["a"],
      }).toListId
    ).toBeNull();
    expect(normalizePushAction("accepted")).toBe("accepted");
    expect(() => normalizePushAction("done")).toThrow("动作");
    expect(normalizeDashboardScope(undefined)).toBe("summary");
    expect(() => normalizeDashboardScope("other")).toThrow("Tab");
    expect(normalizeDashboardLimit(100)).toBe(20);
    expect(normalizeDashboardLimit("bad")).toBe(5);
  });
});
