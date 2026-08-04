import { createHash, randomUUID } from 'node:crypto';
import { Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { InjectDataSource } from '@midwayjs/typeorm';
import { CoolCommException } from '@cool-midway/core';
import { DataSource } from 'typeorm';
import {
  LEGACY_IMPORT_TABLES,
  planLegacyBusinessImport,
  type LegacyImportDomainPlan,
  type LegacyImportPlanRequest,
  type LegacyImportTableName,
} from '../domain/legacy-import';
import { OpenIssueAccessService } from './access';

const LEGACY_IMPORT_PLAN_TTL_MS = 15 * 60 * 1000;

const TARGET_TABLE_NAMES: Record<LegacyImportTableName, string> = {
  issueLists: 'oip_issue_list',
  issueListMembers: 'oip_issue_list_member',
  issues: 'oip_issue',
  issueListLinks: 'oip_issue_list_link',
  checkpoints: 'oip_checkpoint',
  eightDReports: 'oip_eight_d_report',
  pushRecords: 'oip_push_record',
  poiFunctions: 'oip_function',
};

type Row = Record<string, unknown>;

export interface LegacyImportTargetConflict {
  table: LegacyImportTableName;
  key: 'id' | 'member' | 'issueNo' | 'link' | 'function';
  count: number;
  sourceId?: string;
  targetId?: string;
  value?: string;
}

export interface LegacyImportExistingSkip {
  table: LegacyImportTableName;
  sourceId: string;
  targetId: string;
  reason: 'id' | 'member' | 'issueNo' | 'link' | 'function' | 'content-signature';
  value?: string;
}

export interface LegacyImportDryRunPlan {
  dryRun: true;
  planId: string | null;
  expiresAt: string | null;
  executionAllowed: boolean;
  sourceSha256: string | null;
  businessSha256: string | null;
  mappingSha256: string | null;
  counts: Record<LegacyImportTableName, number>;
  insertCounts: Record<LegacyImportTableName, number>;
  totalRows: number;
  userReferences: number;
  orgUnitReferences: number;
  idRemaps: LegacyImportDomainPlan['idRemaps'];
  validationBlockers: string[];
  executionBlockers: string[];
  warnings: string[];
  targetConflicts: LegacyImportTargetConflict[];
  skippedExisting: LegacyImportExistingSkip[];
  targetSnapshotSha256: string | null;
  gates: {
    packageValidated: boolean;
    hostMappingsValidated: boolean;
    targetConflictFree: boolean;
    trustedBackupVerifier: false;
    restoreRehearsalVerifier: false;
    manualBackupConfirmationRequired: true;
    transactionExecutor: true;
  };
}

export interface LegacyImportPreparedPlan {
  planId: string;
  expiresAt: number;
  sourceSha256: string;
  businessSha256: string;
  mappingSha256: string;
  targetSnapshotSha256: string;
  tables: NonNullable<LegacyImportDomainPlan['tables']>;
  skippedExisting: LegacyImportExistingSkip[];
}

type LegacyImportProcessState = typeof globalThis & {
  __phoenixOpenIssueLegacyImportPlans?: Map<string, LegacyImportPreparedPlan>;
};

const legacyImportProcessState = globalThis as LegacyImportProcessState;
const LEGACY_IMPORT_PREPARED_PLANS =
  legacyImportProcessState.__phoenixOpenIssueLegacyImportPlans ??= new Map();

export interface LegacyImportExecutionOptions {
  confirmed: unknown;
  backupConfirmed: unknown;
}

export interface LegacyImportExecutionResult {
  planId: string;
  executedAt: string;
  inserted: Record<LegacyImportTableName, number>;
  totalInserted: number;
  skippedExisting: LegacyImportExistingSkip[];
  warnings: string[];
}

export interface LegacyImportHostReferenceContext {
  moduleId: 'phoenix-open-issue';
  sourceSha256: string;
  userIds: string[];
  orgUnitIds: string[];
}

export type LegacyImportHostReferenceVerifier = (
  context: LegacyImportHostReferenceContext
) => Promise<void>;

interface HostMappingCheck {
  valid: boolean;
  blockers: string[];
}

interface TargetCheck {
  tables: NonNullable<LegacyImportDomainPlan['tables']>;
  conflicts: LegacyImportTargetConflict[];
  skippedExisting: LegacyImportExistingSkip[];
  blockers: string[];
  warnings: string[];
  snapshotSha256: string | null;
}

function isRecord(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pairs(rows: Row[], left: string, right: string): Set<string> {
  return new Set(rows.map(row => `${String(row[left])}\u0000${String(row[right])}`));
}

function values(rows: Row[], field: string): string[] {
  return rows.map(row => String(row[field]));
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function eightDText(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

function eightDSignature(row: Row): string {
  return ['relatedIssueId', 'containment', 'rootCause', 'correctiveAction']
    .map(field => eightDText(row[field]))
    .join('\u0000');
}

function copyTables(
  tables: NonNullable<LegacyImportDomainPlan['tables']>
): NonNullable<LegacyImportDomainPlan['tables']> {
  return Object.fromEntries(LEGACY_IMPORT_TABLES.map(table => [
    table,
    tables[table].map(row => ({ ...row })),
  ])) as NonNullable<LegacyImportDomainPlan['tables']>;
}

function tableCounts(
  tables: NonNullable<LegacyImportDomainPlan['tables']> | null
): Record<LegacyImportTableName, number> {
  return Object.fromEntries(LEGACY_IMPORT_TABLES.map(table => [
    table,
    tables?.[table].length ?? 0,
  ])) as Record<LegacyImportTableName, number>;
}

function mappingSignature(
  request: LegacyImportPlanRequest,
  domainPlan: LegacyImportDomainPlan
): string | null {
  if (!domainPlan.tables || !isRecord(request.mappings)) return null;
  const users = isRecord(request.mappings.users) ? request.mappings.users : {};
  const orgUnits = isRecord(request.mappings.orgUnits) ? request.mappings.orgUnits : {};
  return sha256({
    users: domainPlan.userReferences.map(sourceId => [sourceId, users[sourceId]]),
    orgUnits: domainPlan.orgUnitReferences.map(sourceId => [sourceId, orgUnits[sourceId]]),
  });
}

/**
 * Host 用户只读验证扩展点。默认没有验证器，因此不会读取 Host 私有表，
 * 也不会在公共契约缺失时把映射误判为可执行。
 */
@Provide()
@Scope(ScopeEnum.Singleton)
export class OpenIssueLegacyImportHostReferenceGate {
  private verifier?: LegacyImportHostReferenceVerifier;

  registerVerifier(verifier: LegacyImportHostReferenceVerifier): void {
    if (this.verifier && this.verifier !== verifier) {
      throw new CoolCommException('旧站迁移 Host 引用验证器已登记', 409);
    }
    this.verifier = verifier;
  }

  async verify(context: LegacyImportHostReferenceContext): Promise<void> {
    if (!this.verifier) {
      throw new CoolCommException('Host 用户公共验证端口尚未接入', 503);
    }
    await this.verifier(context);
  }
}

@Provide()
export class OpenIssueLegacyImportService {
  @Inject()
  access: OpenIssueAccessService;

  @InjectDataSource()
  dataSource: DataSource;

  @Inject()
  hostReferenceGate: OpenIssueLegacyImportHostReferenceGate;

  // Service 会因 request-scoped actor 被按请求实例化；计划必须跨请求共享。
  // 挂在进程全局还能承受开发模式的容器热重载，进程重启后仍按设计失效。
  private readonly plans = LEGACY_IMPORT_PREPARED_PLANS;

  private assertAdmin(): void {
    if (!this.access.isHostRoot()) {
      throw new CoolCommException('仅 Host 系统管理员可预检旧站数据迁移', 403);
    }
  }

  private pruneExpiredPlans(now = Date.now()): void {
    for (const [planId, plan] of this.plans) {
      if (plan.expiresAt <= now) this.plans.delete(planId);
    }
  }

  private async validateHostMappings(
    request: LegacyImportPlanRequest,
    domainPlan: LegacyImportDomainPlan
  ): Promise<HostMappingCheck> {
    const root = isRecord(request.mappings) ? request.mappings : {};
    const users = isRecord(root.users) ? root.users : {};
    const valid = domainPlan.userReferences.every(sourceId => {
      const targetId = users[sourceId];
      return typeof targetId === 'string' && /^\d+$/.test(targetId);
    });
    return {
      valid,
      blockers: valid ? [] : ['Host 用户映射未完整提交'],
    };
  }

  private async skipExistingIds(
    table: LegacyImportTableName,
    rows: Row[],
    skippedExisting: LegacyImportExistingSkip[]
  ): Promise<Row[]> {
    const ids = values(rows, 'id');
    if (!ids.length) return rows;
    const existing = await this.dataSource.query(
      `SELECT id FROM ${TARGET_TABLE_NAMES[table]} WHERE id = ANY($1::varchar[])`,
      [ids]
    ) as Row[];
    const existingIds = new Set(existing.map(row => String(row.id)));
    return rows.filter(row => {
      const sourceId = String(row.id);
      if (!existingIds.has(sourceId)) return true;
      skippedExisting.push({ table, sourceId, targetId: sourceId, reason: 'id' });
      return false;
    });
  }

  private async targetCheck(
    tables: NonNullable<LegacyImportDomainPlan['tables']>,
    databaseIdentity: Row
  ): Promise<TargetCheck> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const conflicts: LegacyImportTargetConflict[] = [];
    const skippedExisting: LegacyImportExistingSkip[] = [];
    const plannedTables = copyTables(tables);
    const rowCounts: Record<string, number> = {};
    try {
      for (const table of LEGACY_IMPORT_TABLES.filter(table => table !== 'eightDReports')) {
        const countRows = await this.dataSource.query(
          `SELECT COUNT(*)::int AS count FROM ${TARGET_TABLE_NAMES[table]}`
        ) as Row[];
        rowCounts[table] = Number(countRows[0]?.count ?? 0);
        plannedTables[table] = await this.skipExistingIds(
          table,
          plannedTables[table],
          skippedExisting
        );
      }

      const memberPairs = pairs(plannedTables.issueListMembers, 'listId', 'userId');
      if (memberPairs.size) {
        const listIds = values(plannedTables.issueListMembers, 'listId');
        const rows = await this.dataSource.query(
          `SELECT id, "listId", "userId" FROM oip_issue_list_member
             WHERE "listId" = ANY($1::varchar[])`,
          [listIds]
        ) as Row[];
        const targets = new Map(rows.map(row => [
          `${String(row.listId)}\u0000${String(row.userId)}`,
          String(row.id),
        ]));
        plannedTables.issueListMembers = plannedTables.issueListMembers.filter(row => {
          const targetId = targets.get(`${String(row.listId)}\u0000${String(row.userId)}`);
          if (!targetId) return true;
          skippedExisting.push({
            table: 'issueListMembers', sourceId: String(row.id), targetId, reason: 'member',
          });
          return false;
        });
      }

      const issueNumbers = new Set(values(plannedTables.issues, 'issueNo'));
      if (issueNumbers.size) {
        const rows = await this.dataSource.query(
          `SELECT id, "issueNo" FROM oip_issue WHERE "issueNo" = ANY($1::varchar[])`,
          [[...issueNumbers]]
        ) as Row[];
        const targets = new Map(rows.map(row => [String(row.issueNo), String(row.id)]));
        const issueRemaps = new Map<string, string>();
        plannedTables.issues = plannedTables.issues.filter(row => {
          const issueNo = String(row.issueNo);
          const targetId = targets.get(issueNo);
          if (!targetId) return true;
          const sourceId = String(row.id);
          issueRemaps.set(sourceId, targetId);
          skippedExisting.push({
            table: 'issues', sourceId, targetId, reason: 'issueNo', value: issueNo,
          });
          return false;
        });
        if (issueRemaps.size) {
          const remapIssueField = (rows: Row[], field: string) => rows.map(row => {
            const targetId = issueRemaps.get(String(row[field]));
            return targetId ? { ...row, [field]: targetId } : row;
          });
          plannedTables.issueListLinks = remapIssueField(
            plannedTables.issueListLinks,
            'issueId'
          );
          plannedTables.checkpoints = remapIssueField(plannedTables.checkpoints, 'issueId');
          plannedTables.eightDReports = remapIssueField(
            plannedTables.eightDReports,
            'relatedIssueId'
          );
          plannedTables.pushRecords = remapIssueField(plannedTables.pushRecords, 'issueId');
        }
      }

      const linkPairs = pairs(plannedTables.issueListLinks, 'issueId', 'listId');
      if (linkPairs.size) {
        const issueIds = values(plannedTables.issueListLinks, 'issueId');
        const rows = await this.dataSource.query(
          `SELECT id, "issueId", "listId" FROM oip_issue_list_link
             WHERE "issueId" = ANY($1::varchar[])`,
          [issueIds]
        ) as Row[];
        const targets = new Map(rows.map(row => [
          `${String(row.issueId)}\u0000${String(row.listId)}`,
          String(row.id),
        ]));
        plannedTables.issueListLinks = plannedTables.issueListLinks.filter(row => {
          const targetId = targets.get(`${String(row.issueId)}\u0000${String(row.listId)}`);
          if (!targetId) return true;
          skippedExisting.push({
            table: 'issueListLinks', sourceId: String(row.id), targetId, reason: 'link',
          });
          return false;
        });
      }

      const functionPairs = pairs(plannedTables.poiFunctions, 'platform', 'externalId');
      if (functionPairs.size) {
        const platforms = values(plannedTables.poiFunctions, 'platform');
        const rows = await this.dataSource.query(
          `SELECT id, platform, "externalId" FROM oip_function
             WHERE platform = ANY($1::varchar[])`,
          [platforms]
        ) as Row[];
        const targets = new Map(rows.map(row => [
          `${String(row.platform)}\u0000${String(row.externalId)}`,
          String(row.id),
        ]));
        const functionRemaps = new Map<string, string>();
        plannedTables.poiFunctions = plannedTables.poiFunctions.filter(row => {
          const targetId = targets.get(`${String(row.platform)}\u0000${String(row.externalId)}`);
          if (!targetId) return true;
          const sourceId = String(row.id);
          functionRemaps.set(sourceId, targetId);
          skippedExisting.push({
            table: 'poiFunctions', sourceId, targetId, reason: 'function',
          });
          return false;
        });
        if (functionRemaps.size) {
          plannedTables.issues = plannedTables.issues.map(row => {
            const targetId = functionRemaps.get(String(row.functionId));
            return targetId ? { ...row, functionId: targetId } : row;
          });
        }
      }
      const coreSkipped = skippedExisting.filter(item => item.table !== 'eightDReports').length;
      if (coreSkipped) {
        warnings.push(`${coreSkipped} 条核心业务记录已存在；保留目标记录并跳过重复源行`);
      }
    } catch {
      blockers.push('Open Issue 目标表或冲突快照不可用');
    }
    try {
      const countRows = await this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM ${TARGET_TABLE_NAMES.eightDReports}`
      ) as Row[];
      rowCounts.eightDReports = Number(countRows[0]?.count ?? 0);
      const planned = plannedTables.eightDReports;
      const ids = values(planned, 'id');
      const existingById = ids.length
        ? await this.dataSource.query(
          `SELECT id FROM oip_eight_d_report WHERE id = ANY($1::varchar[])`,
          [ids]
        ) as Row[]
        : [];
      const existingIds = new Set(existingById.map(row => String(row.id)));
      const remaining = planned.filter(row => {
        const sourceId = String(row.id);
        if (!existingIds.has(sourceId)) return true;
        skippedExisting.push({
          table: 'eightDReports', sourceId, targetId: sourceId, reason: 'id',
        });
        return false;
      });
      const relatedIssueIds = [...new Set(values(remaining, 'relatedIssueId'))];
      const existingByContent = relatedIssueIds.length
        ? await this.dataSource.query(
          `SELECT id, "relatedIssueId", containment, "rootCause", "correctiveAction"
             FROM oip_eight_d_report
            WHERE "relatedIssueId" = ANY($1::varchar[])`,
          [relatedIssueIds]
        ) as Row[]
        : [];
      const targetBySignature = new Map(
        existingByContent.map(row => [eightDSignature(row), String(row.id)])
      );
      plannedTables.eightDReports = remaining.filter(row => {
        const targetId = targetBySignature.get(eightDSignature(row));
        if (!targetId) return true;
        skippedExisting.push({
          table: 'eightDReports',
          sourceId: String(row.id),
          targetId,
          reason: 'content-signature',
        });
        return false;
      });
      const skippedEightD = skippedExisting.filter(item => item.table === 'eightDReports').length;
      if (skippedEightD) {
        warnings.push(`${skippedEightD} 条目标库已存在的 8D 报告将跳过并写入迁移审计`);
      }
    } catch {
      const skipped = plannedTables.eightDReports.length;
      plannedTables.eightDReports = [];
      rowCounts.eightDReports = -1;
      if (skipped) {
        warnings.push(`8D 目标表或查重不可用，本阶段已跳过 ${skipped} 条；不阻断核心业务迁移`);
      }
    }
    if (conflicts.length) {
      blockers.push(`目标库存在 ${conflicts.reduce((total, item) => total + item.count, 0)} 项冲突`);
    }
    const snapshotSha256 = blockers.some(item => item.includes('快照不可用'))
      ? null
      : createHash('sha256').update(JSON.stringify({
        databaseIdentity,
        rowCounts,
        conflicts,
        skippedExisting,
        optionalWarnings: warnings,
      })).digest('hex');
    return { tables: plannedTables, conflicts, skippedExisting, blockers, warnings, snapshotSha256 };
  }

  async plan(request: LegacyImportPlanRequest): Promise<LegacyImportDryRunPlan> {
    this.assertAdmin();
    this.pruneExpiredPlans();
    const domainPlan = planLegacyBusinessImport(request);
    const businessSha256 = domainPlan.tables ? sha256(domainPlan.tables) : null;
    const mappingSha256 = mappingSignature(request, domainPlan);
    const validationBlockers = [...domainPlan.blockers];
    let hostMappingsValidated = false;
    let targetConflictFree = false;
    let targetConflicts: LegacyImportTargetConflict[] = [];
    let skippedExisting: LegacyImportExistingSkip[] = [];
    let preparedTables = domainPlan.tables;
    const warnings = [...domainPlan.warnings];
    let targetSnapshotSha256: string | null = null;
    let databaseIdentity: Row | null = null;

    if (domainPlan.tables) {
      const hostCheck = await this.validateHostMappings(request, domainPlan);
      hostMappingsValidated = hostCheck.valid;
      validationBlockers.push(...hostCheck.blockers);
      try {
        const identityRows = await this.dataSource.query(
          `SELECT current_database() AS database, current_schema() AS schema`
        ) as Row[];
        databaseIdentity = identityRows[0] ?? null;
        if (!databaseIdentity) validationBlockers.push('无法识别目标 PostgreSQL 数据库');
      } catch {
        validationBlockers.push('无法识别目标 PostgreSQL 数据库');
      }
      if (databaseIdentity) {
        const target = await this.targetCheck(domainPlan.tables, databaseIdentity);
        targetConflicts = target.conflicts;
        skippedExisting = target.skippedExisting;
        preparedTables = target.tables;
        targetSnapshotSha256 = target.snapshotSha256;
        validationBlockers.push(...target.blockers);
        warnings.push(...target.warnings);
        targetConflictFree = target.blockers.length === 0 && target.conflicts.length === 0;
      }
    }

    const executionBlockers: string[] = [];
    let planId: string | null = null;
    let expiresAt: string | null = null;
    if (
      domainPlan.tables &&
      domainPlan.sourceSha256 &&
      businessSha256 &&
      mappingSha256 &&
      targetSnapshotSha256 &&
      validationBlockers.length === 0
    ) {
      planId = randomUUID();
      const expiresAtValue = Date.now() + LEGACY_IMPORT_PLAN_TTL_MS;
      expiresAt = new Date(expiresAtValue).toISOString();
      this.plans.set(planId, {
        planId,
        expiresAt: expiresAtValue,
        sourceSha256: domainPlan.sourceSha256,
        businessSha256,
        mappingSha256,
        targetSnapshotSha256,
        tables: preparedTables!,
        skippedExisting,
      });
    }

    return {
      dryRun: true,
      planId,
      expiresAt,
      executionAllowed: Boolean(planId),
      sourceSha256: domainPlan.sourceSha256,
      businessSha256,
      mappingSha256,
      counts: domainPlan.counts,
      insertCounts: tableCounts(preparedTables),
      totalRows: domainPlan.totalRows,
      userReferences: domainPlan.userReferences.length,
      orgUnitReferences: domainPlan.orgUnitReferences.length,
      idRemaps: domainPlan.idRemaps,
      validationBlockers,
      executionBlockers,
      warnings,
      targetConflicts,
      skippedExisting,
      targetSnapshotSha256,
      gates: {
        packageValidated: domainPlan.blockers.length === 0,
        hostMappingsValidated,
        targetConflictFree,
        trustedBackupVerifier: false,
        restoreRehearsalVerifier: false,
        manualBackupConfirmationRequired: true,
        transactionExecutor: true,
      },
    };
  }

  async execute(
    planId: unknown,
    options: LegacyImportExecutionOptions
  ): Promise<LegacyImportExecutionResult> {
    this.assertAdmin();
    if (typeof planId !== 'string' || !planId.trim()) {
      throw new CoolCommException('缺少旧站迁移计划 ID', 400);
    }
    if (options.confirmed !== true || options.backupConfirmed !== true) {
      throw new CoolCommException('执行前必须明确确认导入和可恢复的 PostgreSQL 备份', 400);
    }
    const plan = this.claimPreparedPlan(planId);
    const coreOrder: LegacyImportTableName[] = [
      'poiFunctions',
      'issueLists',
      'issueListMembers',
      'issues',
      'issueListLinks',
      'checkpoints',
      'pushRecords',
    ];
    await this.dataSource.transaction(async manager => {
      for (const table of coreOrder) {
        const rows = plan.tables[table];
        if (!rows.length) continue;
        await manager.createQueryBuilder()
          .insert()
          .into(TARGET_TABLE_NAMES[table])
          .values(rows)
          .execute();
      }
    });
    const inserted = tableCounts(null);
    for (const table of coreOrder) inserted[table] = plan.tables[table].length;
    const warnings: string[] = [];
    const optionalEightDRows = plan.tables.eightDReports;
    if (optionalEightDRows.length) {
      try {
        await this.dataSource.transaction(async manager => {
          await manager.createQueryBuilder()
            .insert()
            .into(TARGET_TABLE_NAMES.eightDReports)
            .values(optionalEightDRows)
            .execute();
        });
        inserted.eightDReports = optionalEightDRows.length;
      } catch {
        warnings.push(
          `8D 可选导入失败，已跳过 ${optionalEightDRows.length} 条；核心业务事务已提交`
        );
      }
    }
    return {
      planId: plan.planId,
      executedAt: new Date().toISOString(),
      inserted,
      totalInserted: Object.values(inserted).reduce((total, count) => total + count, 0),
      skippedExisting: plan.skippedExisting,
      warnings,
    };
  }

  /**
   * 预留给未来 Host 受信执行器；当前控制器不会暴露认领或写入端点。
   * 计划在首次认领时即删除，确保未来执行契约具备一次性语义。
   */
  claimPreparedPlan(planId: string): LegacyImportPreparedPlan {
    this.assertAdmin();
    const plan = this.plans.get(planId);
    this.plans.delete(planId);
    if (!plan || plan.expiresAt <= Date.now()) {
      throw new CoolCommException('旧站迁移计划不存在、已过期或已认领', 400);
    }
    return plan;
  }
}
