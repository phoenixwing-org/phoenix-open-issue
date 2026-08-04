import { createHash } from 'node:crypto';

export const LEGACY_IMPORT_TABLES = [
  'issueLists',
  'issueListMembers',
  'issues',
  'issueListLinks',
  'checkpoints',
  'eightDReports',
  'pushRecords',
  'poiFunctions',
] as const;

export type LegacyImportTableName = (typeof LEGACY_IMPORT_TABLES)[number];
type Row = Record<string, unknown>;

export interface LegacyImportMappings {
  users: Record<string, string>;
  orgUnits: Record<string, string>;
}

export interface LegacyImportPlanRequest {
  package: unknown;
  mappings: unknown;
}

export interface LegacyImportIdRemap {
  table: LegacyImportTableName;
  sourceId: string;
  targetId: string;
  reason: 'target-id-length';
}

export interface LegacyImportDomainPlan {
  sourceSha256: string | null;
  counts: Record<LegacyImportTableName, number>;
  totalRows: number;
  userReferences: string[];
  orgUnitReferences: string[];
  blockers: string[];
  warnings: string[];
  idRemaps: LegacyImportIdRemap[];
  tables: Record<LegacyImportTableName, Row[]> | null;
}

const TARGET_FIELDS: Record<LegacyImportTableName, readonly string[]> = {
  issueLists: [
    'id', 'name', 'description', 'listType', 'ownerId', 'orgUnitId', 'archived',
    'isDeleted', 'deletedAt', 'createdAt', 'updatedAt',
  ],
  issueListMembers: ['id', 'listId', 'userId', 'role', 'joinedAt'],
  issues: [
    'id', 'listId', 'issueNo', 'title', 'description', 'status', 'closeReason',
    'closedBy', 'priority', 'severity', 'category', 'detectionPhase', 'reporterId',
    'assigneeId', 'dueDate', 'completedAt', 'sortOrder', 'extensions', 'listCount',
    'createdBy', 'createdAt', 'updatedAt', 'functionId',
  ],
  issueListLinks: [
    'id', 'issueId', 'listId', 'attentionLevel', 'attentionUpdatedAt',
    'attentionUpdatedBy', 'linkedAt', 'linkedBy',
  ],
  checkpoints: [
    'id', 'issueId', 'checkpointDate', 'deadline', 'description', 'status',
    'responsibleUserId', 'sortOrder', 'createdAt', 'updatedAt',
  ],
  eightDReports: [
    'id', 'relatedIssueId', 'title', 'containment', 'rootCause', 'correctiveAction',
    'createdBy', 'createdAt', 'updatedAt', 'isDeleted', 'deletedAt',
  ],
  pushRecords: [
    'id', 'fromListId', 'targetType', 'toListId', 'toUserId', 'issueId',
    'pushedBy', 'pushedAt', 'status', 'handledBy', 'handledAt', 'rejectReason', 'note',
  ],
  poiFunctions: [
    'id', 'platform', 'externalId', 'functionName', 'targetYear', 'clientGroup',
    'developGroup', 'enabled', 'createdAt', 'updatedAt',
  ],
};

const REQUIRED_FIELDS: Record<LegacyImportTableName, readonly string[]> = {
  issueLists: ['id', 'name', 'listType', 'ownerId', 'createdAt', 'updatedAt'],
  issueListMembers: ['id', 'listId', 'userId', 'role', 'joinedAt'],
  issues: [
    'id', 'listId', 'issueNo', 'title', 'status', 'priority', 'severity',
    'createdBy', 'createdAt', 'updatedAt',
  ],
  issueListLinks: ['id', 'issueId', 'listId', 'linkedAt', 'linkedBy'],
  checkpoints: [
    'id', 'issueId', 'checkpointDate', 'description', 'status', 'createdAt', 'updatedAt',
  ],
  eightDReports: ['id', 'title', 'createdBy', 'createdAt', 'updatedAt'],
  pushRecords: ['id', 'fromListId', 'issueId', 'pushedBy', 'pushedAt', 'status'],
  poiFunctions: [
    'id', 'platform', 'externalId', 'functionName', 'createdAt', 'updatedAt',
  ],
};

const LEGACY_ISSUE_8D_FIELDS = ['containment', 'rootCause', 'correctiveAction'] as const;
const USER_REFERENCE_FIELDS: ReadonlyArray<readonly [LegacyImportTableName, string]> = [
  ['issueLists', 'ownerId'],
  ['issueListMembers', 'userId'],
  ['issues', 'reporterId'],
  ['issues', 'assigneeId'],
  ['issues', 'closedBy'],
  ['issues', 'createdBy'],
  ['issueListLinks', 'linkedBy'],
  ['issueListLinks', 'attentionUpdatedBy'],
  ['checkpoints', 'responsibleUserId'],
  ['pushRecords', 'pushedBy'],
  ['pushRecords', 'toUserId'],
  ['pushRecords', 'handledBy'],
];

function isRecord(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function emptyCounts(): Record<LegacyImportTableName, number> {
  return Object.fromEntries(LEGACY_IMPORT_TABLES.map(table => [table, 0])) as Record<
    LegacyImportTableName,
    number
  >;
}

function emptyTables(): Record<LegacyImportTableName, Row[]> {
  return Object.fromEntries(LEGACY_IMPORT_TABLES.map(table => [table, []])) as Record<
    LegacyImportTableName,
    Row[]
  >;
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function collectReferences(
  tables: Record<LegacyImportTableName, Row[]>,
  fields: ReadonlyArray<readonly [LegacyImportTableName, string]>
): string[] {
  return unique(fields.flatMap(([table, field]) => tables[table].map(row => text(row[field]))));
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

function pair(left: unknown, right: unknown): string {
  return `${String(left ?? '')}\u0000${String(right ?? '')}`;
}

function deterministicLegacyId(table: LegacyImportTableName, sourceId: string): string {
  const hex = createHash('sha256')
    .update(`phoenix-open-issue\u0000legacy-v1\u0000${table}\u0000${sourceId}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex
    .slice(12, 16)
    .join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

function pick(row: Row, fields: readonly string[]): Row {
  return Object.fromEntries(
    fields.filter(field => row[field] !== undefined).map(field => [field, row[field]])
  );
}

function validateRows(
  tables: Record<LegacyImportTableName, Row[]>,
  blockers: string[]
): void {
  for (const table of LEGACY_IMPORT_TABLES) {
    if (table === 'eightDReports') continue;
    const allowed = new Set(TARGET_FIELDS[table]);
    if (table === 'issues') LEGACY_ISSUE_8D_FIELDS.forEach(field => allowed.add(field));
    tables[table].forEach((row, index) => {
      const unknown = Object.keys(row).filter(field => !allowed.has(field));
      if (unknown.length) blockers.push(`${table}[${index}] 包含未知字段：${unknown.join('、')}`);
      const missing = REQUIRED_FIELDS[table].filter(field => !text(row[field]));
      if (missing.length) blockers.push(`${table}[${index}] 缺少字段：${missing.join('、')}`);
      const id = text(row.id);
      if (id && id.length > 36) {
        blockers.push(`${table}[${index}].id 超过目标长度 36`);
      }
    });
  }
}

function validateUniqueness(
  tables: Record<LegacyImportTableName, Row[]>,
  blockers: string[]
): void {
  for (const table of LEGACY_IMPORT_TABLES) {
    if (table === 'eightDReports') continue;
    const duplicates = duplicateValues(tables[table].map(row => String(row.id ?? '')));
    if (duplicates.length) blockers.push(`${table} 存在重复 id（${duplicates.length}）`);
  }
  const uniqueKeys: Array<readonly [LegacyImportTableName, string, string[]]> = [
    ['issueListMembers', '(listId,userId)', tables.issueListMembers.map(row => pair(row.listId, row.userId))],
    ['issues', 'issueNo', tables.issues.map(row => String(row.issueNo ?? ''))],
    ['issueListLinks', '(issueId,listId)', tables.issueListLinks.map(row => pair(row.issueId, row.listId))],
    ['poiFunctions', '(platform,externalId)', tables.poiFunctions.map(row => pair(row.platform, row.externalId))],
  ];
  for (const [table, label, values] of uniqueKeys) {
    const duplicates = duplicateValues(values);
    if (duplicates.length) blockers.push(`${table} 存在重复 ${label}（${duplicates.length}）`);
  }
}

function validateReferences(
  tables: Record<LegacyImportTableName, Row[]>,
  blockers: string[]
): void {
  const listIds = new Set(tables.issueLists.map(row => String(row.id)));
  const issueIds = new Set(tables.issues.map(row => String(row.id)));
  const functionIds = new Set(tables.poiFunctions.map(row => String(row.id)));
  const checks: Array<readonly [LegacyImportTableName, string, Set<string>, string]> = [
    ['issueListMembers', 'listId', listIds, '问题列表'],
    ['issues', 'listId', listIds, '问题列表'],
    ['issueListLinks', 'issueId', issueIds, 'Issue'],
    ['issueListLinks', 'listId', listIds, '问题列表'],
    ['checkpoints', 'issueId', issueIds, 'Issue'],
    ['pushRecords', 'issueId', issueIds, 'Issue'],
    ['pushRecords', 'fromListId', listIds, '问题列表'],
    ['pushRecords', 'toListId', listIds, '问题列表'],
    ['issues', 'functionId', functionIds, '功能'],
  ];
  for (const [table, field, target, label] of checks) {
    const missing = tables[table].filter(row => {
      const value = text(row[field]);
      return value ? !target.has(value) : false;
    }).length;
    if (missing) blockers.push(`${table}.${field} 有 ${missing} 条引用缺失的${label}`);
  }
}

function validateProtocols(
  tables: Record<LegacyImportTableName, Row[]>,
  blockers: string[]
): void {
  const rules: Array<readonly [LegacyImportTableName, string, readonly string[]]> = [
    ['issues', 'status', ['open', 'in_progress', 'resolved', 'closed', 'cancelled']],
    ['issues', 'priority', ['low', 'medium', 'high', 'critical']],
    ['issues', 'severity', ['trivial', 'minor', 'major', 'fatal']],
    ['issueListMembers', 'role', ['owner', 'admin', 'editor', 'reporter', 'viewer']],
    ['checkpoints', 'status', ['pending', 'done', 'skipped', 'voided']],
    ['pushRecords', 'targetType', ['list', 'user']],
    ['pushRecords', 'status', ['pending', 'accepted', 'rejected', 'withdrawn']],
  ];
  for (const [table, field, allowed] of rules) {
    const invalid = tables[table].filter(row => {
      const value = text(row[field]);
      return value ? !allowed.includes(value) : false;
    }).length;
    if (invalid) blockers.push(`${table}.${field} 有 ${invalid} 条未知协议值`);
  }
  const invalidAttention = tables.issueListLinks.filter(row => {
    const value = Number(row.attentionLevel ?? 3);
    return !Number.isInteger(value) || value < 0 || value > 5;
  }).length;
  if (invalidAttention) blockers.push(`issueListLinks.attentionLevel 有 ${invalidAttention} 条越界值`);
}

function resolveOptionalEightD(
  tables: Record<LegacyImportTableName, Row[]>,
  warnings: string[]
): void {
  const allowed = new Set(TARGET_FIELDS.eightDReports);
  const issueIds = new Set(tables.issues.map(row => String(row.id)));
  const seenIds = new Set<string>();
  let invalid = 0;
  let unknownFields = 0;
  const independent = tables.eightDReports.filter(row => {
    const id = text(row.id);
    const relatedIssueId = text(row.relatedIssueId);
    const missing = [...REQUIRED_FIELDS.eightDReports, 'relatedIssueId']
      .some(field => !text(row[field]));
    if (!id || !relatedIssueId || missing || !issueIds.has(relatedIssueId) || seenIds.has(id)) {
      invalid++;
      return false;
    }
    seenIds.add(id);
    if (Object.keys(row).some(field => !allowed.has(field))) unknownFields++;
    return true;
  });
  if (invalid) {
    warnings.push(`${invalid} 条无效或重复 8D 报告已跳过；不阻断 Issue 核心业务`);
  }
  if (unknownFields) {
    warnings.push(`${unknownFields} 条 8D 报告含目标模型之外字段，导入时仅保留已知字段`);
  }

  const independentIssueIds = new Set(independent.map(row => String(row.relatedIssueId)));
  let independentWins = 0;
  const derived = tables.issues.flatMap(issue => {
    const hasEmbedded = LEGACY_ISSUE_8D_FIELDS.some(field => text(issue[field]));
    if (!hasEmbedded) return [];
    const issueId = String(issue.id);
    if (independentIssueIds.has(issueId)) {
      independentWins++;
      return [];
    }
    return [{
      id: deterministicLegacyId('eightDReports', `embedded:${issueId}`),
      relatedIssueId: issueId,
      title: `${String(issue.title || issueId)} 8D`,
      containment: issue.containment ?? '',
      rootCause: issue.rootCause ?? '',
      correctiveAction: issue.correctiveAction ?? '',
      createdBy: issue.createdBy,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      isDeleted: 0,
      deletedAt: null,
    }];
  });
  if (independentWins) {
    warnings.push(`${independentWins} 个 Issue 同时含内嵌 8D；以独立 8D 报告为准`);
  }
  if (derived.length) {
    warnings.push(`${derived.length} 个 Issue 没有独立 8D 报告，已从内嵌字段生成可选报告`);
  }
  tables.eightDReports = [...independent, ...derived];
}

function normalizeMappings(
  value: unknown,
  userReferences: string[],
  blockers: string[]
): LegacyImportMappings {
  const root = isRecord(value) ? value : {};
  const users = isRecord(root.users) ? root.users : {};
  if (!isRecord(value)) blockers.push('缺少 Host 用户映射');
  const normalize = (
    sourceIds: string[],
    mappings: Row,
    label: string
  ): Record<string, string> => Object.fromEntries(sourceIds.flatMap(sourceId => {
    const targetId = text(mappings[sourceId]);
    if (!targetId) {
      blockers.push(`${label} ${sourceId} 尚未映射`);
      return [];
    }
    if (!/^\d+$/.test(targetId)) {
      blockers.push(`${label} ${sourceId} 的 Host ID 必须是数字字符串`);
      return [];
    }
    return [[sourceId, targetId]];
  }));
  return {
    users: normalize(userReferences, users, 'legacy 用户'),
    orgUnits: {},
  };
}

function mapOptional(value: unknown, mappings: Record<string, string>): unknown {
  const sourceId = text(value);
  return sourceId ? mappings[sourceId] ?? value : value ?? null;
}

function normalizedTables(
  tables: Record<LegacyImportTableName, Row[]>,
  mappings: LegacyImportMappings,
  idRemaps: LegacyImportIdRemap[]
): Record<LegacyImportTableName, Row[]> {
  const output = emptyTables();
  const remapBySourceId = new Map(idRemaps.map(item => [item.sourceId, item.targetId]));
  output.issueLists = tables.issueLists.map(row => ({
    ...pick(row, TARGET_FIELDS.issueLists),
    ownerId: mapOptional(row.ownerId, mappings.users),
    orgUnitId: null,
    description: row.description ?? '',
    archived: Number(row.archived ?? 0),
    isDeleted: Number(row.isDeleted ?? 0),
    deletedAt: row.deletedAt ?? null,
  }));
  output.issueListMembers = tables.issueListMembers.map(row => ({
    ...pick(row, TARGET_FIELDS.issueListMembers),
    userId: mapOptional(row.userId, mappings.users),
  }));
  const listCountByIssue = new Map<string, number>();
  for (const link of tables.issueListLinks) {
    const issueId = String(link.issueId);
    listCountByIssue.set(issueId, (listCountByIssue.get(issueId) ?? 0) + 1);
  }
  output.issues = tables.issues.map(row => ({
    ...pick(row, TARGET_FIELDS.issues),
    description: row.description ?? '',
    closeReason: row.closeReason ?? null,
    closedBy: mapOptional(row.closedBy, mappings.users),
    category: row.category ?? null,
    detectionPhase: row.detectionPhase ?? null,
    reporterId: mapOptional(row.reporterId, mappings.users),
    assigneeId: mapOptional(row.assigneeId, mappings.users),
    dueDate: row.dueDate ?? null,
    completedAt: row.completedAt ?? null,
    sortOrder: Number(row.sortOrder ?? 0),
    extensions: isRecord(row.extensions) ? row.extensions : {},
    listCount: listCountByIssue.get(String(row.id)) ?? 0,
    createdBy: mapOptional(row.createdBy, mappings.users),
    functionId: row.functionId ?? null,
  }));
  output.issueListLinks = tables.issueListLinks.map(row => ({
    ...pick(row, TARGET_FIELDS.issueListLinks),
    attentionLevel: Number(row.attentionLevel ?? 3),
    attentionUpdatedAt: row.attentionUpdatedAt ?? null,
    attentionUpdatedBy: mapOptional(row.attentionUpdatedBy, mappings.users),
    linkedBy: mapOptional(row.linkedBy, mappings.users),
  }));
  output.checkpoints = tables.checkpoints.map(row => ({
    ...pick(row, TARGET_FIELDS.checkpoints),
    deadline: Object.prototype.hasOwnProperty.call(row, 'deadline')
      ? row.deadline
      : row.checkpointDate ?? null,
    responsibleUserId: mapOptional(row.responsibleUserId, mappings.users),
    sortOrder: Number(row.sortOrder ?? 0),
  }));
  output.eightDReports = tables.eightDReports.map(row => ({
    ...pick(row, TARGET_FIELDS.eightDReports),
    id: remapBySourceId.get(String(row.id)) ?? row.id,
    relatedIssueId: row.relatedIssueId ?? null,
    containment: row.containment ?? '',
    rootCause: row.rootCause ?? '',
    correctiveAction: row.correctiveAction ?? '',
    createdBy: mapOptional(row.createdBy, mappings.users),
    isDeleted: Number(row.isDeleted ?? 0),
    deletedAt: row.deletedAt ?? null,
  }));
  output.pushRecords = tables.pushRecords.map(row => ({
    ...pick(row, TARGET_FIELDS.pushRecords),
    targetType: row.targetType ?? 'list',
    toListId: row.toListId ?? null,
    toUserId: mapOptional(row.toUserId, mappings.users),
    pushedBy: mapOptional(row.pushedBy, mappings.users),
    handledBy: mapOptional(row.handledBy, mappings.users),
    handledAt: row.handledAt ?? null,
    rejectReason: row.rejectReason ?? null,
    note: row.note ?? '',
  }));
  output.poiFunctions = tables.poiFunctions.map(row => ({
    ...pick(row, TARGET_FIELDS.poiFunctions),
    targetYear: row.targetYear ?? null,
    clientGroup: row.clientGroup ?? null,
    developGroup: row.developGroup ?? null,
    enabled: Number(row.enabled ?? 1),
  }));
  return output;
}

export function planLegacyBusinessImport(request: LegacyImportPlanRequest): LegacyImportDomainPlan {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const counts = emptyCounts();
  const tables = emptyTables();
  const root = isRecord(request.package) ? request.package : {};
  if (!isRecord(request.package)) blockers.push('业务迁移提交必须是对象');
  if (root.dataset !== 'phoenix-open-issue-business-v1') {
    blockers.push('业务迁移数据集标识无效');
  }
  const source = isRecord(root.source) ? root.source : {};
  const sourceSha256 = typeof source.rawSha256 === 'string' ? source.rawSha256 : null;
  if (source.version !== 1 || source.exportScope !== 'full') {
    blockers.push('仅接受从 legacy v1/full 提取的业务数据集');
  }
  if (!sourceSha256 || !/^[a-f0-9]{64}$/.test(sourceSha256)) {
    blockers.push('缺少有效的原始迁移包 SHA-256');
  }
  const inputTables = isRecord(root.tables) ? root.tables : {};
  if (!isRecord(root.tables)) blockers.push('业务迁移提交缺少 tables 对象');
  const extraTables = Object.keys(inputTables).filter(
    table => !LEGACY_IMPORT_TABLES.includes(table as LegacyImportTableName)
  );
  if (extraTables.length) blockers.push(`服务端提交包含非业务数据集：${extraTables.join('、')}`);
  for (const table of LEGACY_IMPORT_TABLES) {
    const rows = inputTables[table];
    if (!Array.isArray(rows)) {
      if (table === 'eightDReports') {
        warnings.push('eightDReports 缺失或格式无效；将尝试从 Issue 内嵌字段生成，不阻断核心业务');
        tables.eightDReports = [];
        continue;
      }
      blockers.push(`${table} 必须是数组`);
      continue;
    }
    const invalid = rows.filter(row => !isRecord(row)).length;
    if (invalid) {
      if (table === 'eightDReports') {
        warnings.push(`eightDReports 包含 ${invalid} 条非对象记录，已跳过且不阻断核心业务`);
      } else {
        blockers.push(`${table} 包含 ${invalid} 条非对象记录`);
      }
    }
    tables[table] = rows.filter(isRecord).map(row => ({ ...row }));
    counts[table] = tables[table].length;
  }

  resolveOptionalEightD(tables, warnings);
  counts.eightDReports = tables.eightDReports.length;

  validateRows(tables, blockers);
  validateUniqueness(tables, blockers);
  validateReferences(tables, blockers);
  validateProtocols(tables, blockers);

  const userReferences = collectReferences(tables, USER_REFERENCE_FIELDS);
  const discardedOrgUnitReferences = collectReferences(tables, [['issueLists', 'orgUnitId']]);
  const orgUnitReferences: string[] = [];
  if (discardedOrgUnitReferences.length) {
    warnings.push(
      `${discardedOrgUnitReferences.length} 个 legacy 列表组织引用属于未使用历史字段，将统一移除`
    );
  }
  const mappings = normalizeMappings(
    request.mappings,
    userReferences,
    blockers
  );
  const unmappedEightDCreators = unique(tables.eightDReports.map(row => text(row.createdBy)))
    .filter(sourceId => !/^\d+$/.test(sourceId) && !mappings.users[sourceId]);
  if (unmappedEightDCreators.length) {
    const before = tables.eightDReports.length;
    tables.eightDReports = tables.eightDReports.filter(row => {
      const sourceId = text(row.createdBy);
      return !sourceId || /^\d+$/.test(sourceId) || Boolean(mappings.users[sourceId]);
    });
    const skipped = before - tables.eightDReports.length;
    counts.eightDReports = tables.eightDReports.length;
    if (skipped) warnings.push(`${skipped} 条 8D 报告的创建人无法映射，已跳过且不阻断核心业务`);
  }
  const idRemaps = tables.eightDReports.flatMap(row => {
    const sourceId = text(row.id);
    if (!sourceId || sourceId.length <= 36) return [];
    return [{
      table: 'eightDReports' as const,
      sourceId,
      targetId: deterministicLegacyId('eightDReports', sourceId),
      reason: 'target-id-length' as const,
    }];
  });
  if (idRemaps.length) warnings.push(`${idRemaps.length} 个 8D 报告 ID 将确定性重映射`);

  const totalRows = Object.values(counts).reduce((total, count) => total + count, 0);
  if (totalRows === 0) blockers.push('业务迁移数据集为空');
  return {
    sourceSha256,
    counts,
    totalRows,
    userReferences,
    orgUnitReferences,
    blockers,
    warnings,
    idRemaps,
    tables: blockers.length ? null : normalizedTables(tables, mappings, idRemaps),
  };
}
