import type {
  OpenIssuePushStatus,
  OpenIssuePushTargetType,
} from "../entity/push-record";

export interface OpenIssuePushInput {
  fromListId: string;
  targetType: OpenIssuePushTargetType;
  toListId: string | null;
  toUserId: string | null;
  issueIds: string[];
  note: string;
}

function requiredText(value: unknown, message: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(message);
  return result;
}

export function normalizePushInput(value: unknown): OpenIssuePushInput {
  const input = (value ?? {}) as Record<string, unknown>;
  const fromListId = requiredText(input.fromListId, "请选择源列表");
  const targetType: OpenIssuePushTargetType =
    input.targetType === "user" ? "user" : "list";
  const toListId =
    targetType === "list"
      ? requiredText(input.toListId, "请选择目标列表")
      : null;
  const toUserId =
    targetType === "user"
      ? requiredText(input.toUserId, "请选择接收人")
      : null;
  const issueIds = Array.isArray(input.issueIds)
    ? [
        ...new Set(
          input.issueIds
            .map(item => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
        ),
      ]
    : [];
  if (!issueIds.length) throw new Error("请至少选择一个要推送的 Issue");
  if (toListId === fromListId)
    throw new Error("请选择不同的源列表和目标列表");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 500) throw new Error("推送备注不能超过 500 字");
  return { fromListId, targetType, toListId, toUserId, issueIds, note };
}

export function normalizePushAction(value: unknown):
  | "accepted"
  | "rejected" {
  if (value !== "accepted" && value !== "rejected")
    throw new Error("无效的推送处理动作");
  return value;
}

export function normalizeDashboardScope(value: unknown):
  | "summary"
  | "incoming"
  | "outgoing" {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "summary"
  )
    return "summary";
  if (value === "incoming" || value === "outgoing")
    return value;
  throw new Error("无效的待办中心 Tab");
}

export function normalizeDashboardLimit(value: unknown): number {
  const number = Number(value ?? 5);
  return Number.isFinite(number)
    ? Math.max(1, Math.min(20, Math.trunc(number)))
    : 5;
}

export function isPendingPush(status: OpenIssuePushStatus): boolean {
  return status === "pending";
}
