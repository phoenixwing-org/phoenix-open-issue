export interface OpenIssueFunctionInput {
  platform: string;
  externalId: string;
  functionName: string;
  targetYear: string | null;
  clientGroup: string | null;
  developGroup: string | null;
}

export type OpenIssueFunctionUpdate = Partial<OpenIssueFunctionInput>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("功能数据无效");
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, max: number): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > max)
    throw new Error(`${label}必须为 1 至 ${max} 个字符`);
  return result;
}

function optionalText(
  value: unknown,
  label: string,
  max: number
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max)
    throw new Error(`${label}不能超过 ${max} 个字符`);
  return value.trim();
}

export function normalizeFunctionInput(value: unknown): OpenIssueFunctionInput {
  const input = record(value);
  return {
    platform: requiredText(input.platform, "平台", 120),
    externalId: requiredText(input.externalId, "外部 ID", 120),
    functionName: requiredText(input.functionName, "功能名称", 240),
    targetYear: optionalText(input.targetYear, "目标年份", 32),
    clientGroup: optionalText(input.clientGroup, "客户群体", 120),
    developGroup: optionalText(input.developGroup, "开发组", 120),
  };
}

export function normalizeFunctionUpdate(
  value: unknown
): OpenIssueFunctionUpdate {
  const input = record(value);
  const output: OpenIssueFunctionUpdate = {};
  if ("platform" in input)
    output.platform = requiredText(input.platform, "平台", 120);
  if ("externalId" in input)
    output.externalId = requiredText(input.externalId, "外部 ID", 120);
  if ("functionName" in input)
    output.functionName = requiredText(input.functionName, "功能名称", 240);
  if ("targetYear" in input)
    output.targetYear = optionalText(input.targetYear, "目标年份", 32);
  if ("clientGroup" in input)
    output.clientGroup = optionalText(input.clientGroup, "客户群体", 120);
  if ("developGroup" in input)
    output.developGroup = optionalText(input.developGroup, "开发组", 120);
  if (Object.keys(output).length === 0) throw new Error("没有可更新的字段");
  return output;
}

export function normalizeFunctionImportRows(
  value: unknown,
  limit = 5000
): OpenIssueFunctionInput[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("rows 必须是非空数组");
  if (value.length > limit) throw new Error(`单次最多导入 ${limit} 条功能`);
  return value.map(normalizeFunctionInput);
}

export function functionNaturalKey(
  value: Pick<OpenIssueFunctionInput, "platform" | "externalId">
): string {
  return `${value.platform}\u0000${value.externalId}`;
}
