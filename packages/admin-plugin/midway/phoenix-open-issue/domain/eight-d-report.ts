export interface OpenIssueEightDReportInput {
  relatedIssueId: string | null;
  title: string;
  containment: string;
  rootCause: string;
  correctiveAction: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEightDReportInput(
  value: unknown
): OpenIssueEightDReportInput {
  const input = (value ?? {}) as Record<string, unknown>;
  const title = text(input.title);
  if (!title) throw new Error("请填写 8D 报告标题");
  if (title.length > 200) throw new Error("8D 报告标题不能超过 200 字");
  const relatedIssueId = text(input.relatedIssueId);
  return {
    relatedIssueId: relatedIssueId || null,
    title,
    containment: text(input.containment),
    rootCause: text(input.rootCause),
    correctiveAction: text(input.correctiveAction),
  };
}
