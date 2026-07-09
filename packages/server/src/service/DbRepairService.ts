import { getDb } from '../db/connection.js'
import { runSchema } from '../db/schema.js'
import {
  applyColumnMigrations,
  dedupeIssueListLinks,
  runDataMigrations,
  tableExists,
  migrateIssueListLinkAttention,
  repairDictDataAndIndex,
} from '../db/migrations.js'
import { generateId } from '@open-issue/core'

export type RepairTaskId = 'schema' | 'checkpoints' | 'links' | 'dict' | 'users' | 'issueNo' | 'linkAttention' | 'all'

export interface RepairTaskResult {
  task: RepairTaskId
  message: string
  details: string[]
  fixed: number
}

export class DbRepairService {
  /** 表结构：建表 + 补列 + 数据迁移 */
  repairSchema(): RepairTaskResult {
    const db = getDb()
    const details: string[] = []

    // 确保所有表存在（CREATE IF NOT EXISTS）
    runSchema(db)

    const addedCols = applyColumnMigrations(db)
    if (addedCols.length) {
      details.push(`追加列：${addedCols.join('、')}`)
    } else {
      details.push('所有已知列均已存在')
    }

    const data = runDataMigrations(db)
    if (data.userRole.adminSet || data.userRole.editorSet) {
      details.push(`用户权限：admin ${data.userRole.adminSet} 条，editor ${data.userRole.editorSet} 条`)
    }
    if (data.listTypeRebuilt) details.push('已重建 issueLists 表（移除 listType CHECK 约束）')
    if (data.pendingOrgCreated) details.push('已创建「待定组」组织节点')

    const deduped = dedupeIssueListLinks(db)
    if (deduped > 0) details.push(`清理重复 Issue 链接 ${deduped} 条`)

    const missingTables = ['systemFlags', 'poiFunctions', 'checkpoints', 'issueListLinks']
      .filter(t => !tableExists(db, t))
    if (missingTables.length) {
      details.push(`仍缺失表（请重启服务）：${missingTables.join('、')}`)
    }

    return {
      task: 'schema',
      message: addedCols.length ? `已追加 ${addedCols.length} 个列` : '表结构已是最新',
      details,
      fixed: addedCols.length + deduped + data.userRole.adminSet + data.userRole.editorSet,
    }
  }

  /** 点检表：补列 + 回填默认值 */
  repairCheckpoints(): RepairTaskResult {
    const db = getDb()
    if (!tableExists(db, 'checkpoints')) {
      runSchema(db)
    }

    const addedCols = applyColumnMigrations(db).filter(c => c.startsWith('checkpoints.'))
    const details: string[] = []
    if (addedCols.length) details.push(`追加列：${addedCols.join('、')}`)

    const now = new Date().toISOString()
    let fixed = 0

    const r1 = db.run("UPDATE checkpoints SET status = 'pending' WHERE status IS NULL OR status = ''")
    if (r1.changes) { details.push(`补全 status：${r1.changes} 条`); fixed += r1.changes }

    const r2 = db.run('UPDATE checkpoints SET sortOrder = 0 WHERE sortOrder IS NULL')
    if (r2.changes) { details.push(`补全 sortOrder：${r2.changes} 条`); fixed += r2.changes }

    const r3 = db.run("UPDATE checkpoints SET createdAt = ? WHERE createdAt IS NULL OR createdAt = ''", now)
    if (r3.changes) { details.push(`补全 createdAt：${r3.changes} 条`); fixed += r3.changes }

    const r4 = db.run(`
      UPDATE checkpoints SET updatedAt = COALESCE(NULLIF(updatedAt, ''), createdAt, ?)
      WHERE updatedAt IS NULL OR updatedAt = ''
    `, now)
    if (r4.changes) { details.push(`补全 updatedAt：${r4.changes} 条`); fixed += r4.changes }

    if (!details.length) details.push('点检数据无需修正')

    return {
      task: 'checkpoints',
      message: fixed ? `已修正 ${fixed} 条点检记录` : '点检数据已是最新',
      details,
      fixed: fixed + addedCols.length,
    }
  }

  /** Issue 链接补建 */
  repairIssueListLinks(): RepairTaskResult {
    const db = getDb()
    const now = new Date().toISOString()

    if (!tableExists(db, 'issueListLinks')) {
      runSchema(db)
    }
    applyColumnMigrations(db)

    const missing = db.all(`
      SELECT i.id, i.listId, i.createdBy, i.createdAt
      FROM issues i
      WHERE i.listId IS NOT NULL AND i.listId != ''
        AND NOT EXISTS (
          SELECT 1 FROM issueListLinks l
          WHERE l.issueId = i.id AND l.listId = i.listId
        )
    `) as { id: string; listId: string; createdBy: string; createdAt: string }[]

    for (const row of missing) {
      db.run(
        'INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt, attentionLevel) VALUES (?, ?, ?, ?, ?, 3)',
        [generateId(), row.id, row.listId, row.createdBy || 'system', row.createdAt || now],
      )
    }

    // attentionLevel = 0 表示「不关注」，是合法链接，补建时不得 INSERT 也不得强行改回 3

    const deduped = dedupeIssueListLinks(db)
    const total = db.get(`
      SELECT COUNT(*) as c FROM issueListLinks
    `) as { c: number }
    const active = db.get(`
      SELECT COUNT(*) as c FROM issueListLinks
      WHERE attentionLevel > 0
    `) as { c: number }
    const unwatched = db.get(`
      SELECT COUNT(*) as c FROM issueListLinks
      WHERE attentionLevel = 0
    `) as { c: number }

    const details: string[] = []
    if (missing.length) details.push(`补建链接 ${missing.length} 条`)
    details.push(`当前链接 ${total.c} 条（关注 ${active.c} / 不关注 ${unwatched.c}）`)
    if (deduped) details.push(`清理重复 ${deduped} 条`)
    if (!details.length) details.push('链接数据无需修正')

    const fixed = missing.length + deduped

    return {
      task: 'links',
      message: fixed ? `已修正 ${fixed} 条链接` : '链接数据完整',
      details,
      fixed,
    }
  }

  /** 数据字典：补全缺失列、规范 tags 格式、去重（不新增字典行） */
  repairDict(): RepairTaskResult {
    const db = getDb()
    if (!tableExists(db, 'dict')) runSchema(db)
    applyColumnMigrations(db)

    const result = repairDictDataAndIndex(db)

    const total = db.get('SELECT COUNT(*) as c FROM dict') as { c: number }
    const { removed, tagsMerged, tagsMigrated, listTypeCoreTagsFixed, indexOk, duplicateGroupsRemaining } = result

    const needsRetry = !indexOk && duplicateGroupsRemaining > 0

    return {
      task: 'dict',
      message: needsRetry
        ? `去重删除 ${removed} 条，仍有 ${duplicateGroupsRemaining} 组重复，请再执行一次`
        : tagsMigrated || listTypeCoreTagsFixed || removed
          ? `tags 规范 ${tagsMigrated} 条，去重删除 ${removed} 条${indexOk ? '，唯一索引已就绪' : ''}`
          : '字典列与数据已完整',
      details: [
        '已补全 dict 表缺失列（如 tags）',
        tagsMigrated ? `tags 规范为 ,tag, 格式：${tagsMigrated} 条` : 'tags 格式已规范',
        ...(listTypeCoreTagsFixed ? [`点检表类型内置项移除 general 标签：${listTypeCoreTagsFixed} 条`] : []),
        removed ? `同分组重复 value 去重：删除 ${removed} 条，合并 tags ${tagsMerged} 组` : '无重复项',
        indexOk ? '唯一索引 idx_dict_group_value 已建立' : `唯一索引未建立（剩余重复 ${duplicateGroupsRemaining} 组）`,
        '业务表引用 dict 的 value 字段，去重不影响 Issue 等数据',
        `dict 共 ${total.c} 条（未新增行）`,
      ],
      fixed: tagsMigrated + listTypeCoreTagsFixed + removed,
    }
  }

  /** 用户权限回填 */
  repairUsers(): RepairTaskResult {
    const db = getDb()
    if (!tableExists(db, 'users')) runSchema(db)
    applyColumnMigrations(db)

    const data = runDataMigrations(db)
    const fixed = data.userRole.adminSet + data.userRole.editorSet

    return {
      task: 'users',
      message: fixed ? `已修正 ${fixed} 个用户权限` : '用户权限已是最新',
      details: [
        `admin 账号设为管理员：${data.userRole.adminSet} 条`,
        `其余用户默认编辑：${data.userRole.editorSet} 条`,
      ],
      fixed,
    }
  }

  /**
   * Issue 编号去重：发现重复编号时，按 createdAt 顺序重编为 ISS-{年}-0001、0002…
   * 对存在重复的年份，该年所有 ISS-{年}-* 记录一并顺序编号，避免冲突。
   */
  repairIssueNo(): RepairTaskResult {
    const db = getDb()
    if (!tableExists(db, 'issues')) runSchema(db)

    const duplicates = db.all(`
      SELECT issueNo, COUNT(*) as cnt
      FROM issues
      WHERE issueNo IS NOT NULL AND issueNo != ''
      GROUP BY issueNo
      HAVING COUNT(*) > 1
    `) as { issueNo: string; cnt: number }[]

    const emptyCount = db.get(`
      SELECT COUNT(*) as c FROM issues WHERE issueNo IS NULL OR issueNo = ''
    `) as { c: number }

    if (!duplicates.length && !emptyCount.c) {
      return {
        task: 'issueNo',
        message: 'Issue 编号无重复',
        details: [],
        fixed: 0,
      }
    }

    const years = new Set<number>()
    for (const { issueNo } of duplicates) {
      years.add(parseIssueYear(issueNo, ''))
    }
    if (emptyCount.c > 0) {
      const emptyRows = db.all(`
        SELECT createdAt FROM issues WHERE issueNo IS NULL OR issueNo = ''
      `) as { createdAt: string }[]
      for (const row of emptyRows) {
        years.add(parseIssueYear('', row.createdAt))
      }
    }

    const now = new Date().toISOString()
    const details: string[] = []
    const changeLines: string[] = []
    let fixed = 0

    if (duplicates.length) {
      details.push(`发现重复编号 ${duplicates.length} 组：${duplicates.map(d => `${d.issueNo}(×${d.cnt})`).join('、')}`)
    }
    if (emptyCount.c) details.push(`空编号 ${emptyCount.c} 条`)

    for (const year of [...years].sort()) {
      const issues = db.all(`
        SELECT id, issueNo, createdAt FROM issues
        WHERE issueNo LIKE ?
           OR ((issueNo IS NULL OR issueNo = '') AND strftime('%Y', createdAt) = ?)
        ORDER BY createdAt ASC, id ASC
      `, [`ISS-${year}-%`, String(year)]) as { id: string; issueNo: string; createdAt: string }[]

      if (!issues.length) continue

      for (const row of issues) {
        db.run('UPDATE issues SET issueNo = ?, updatedAt = ? WHERE id = ?', [`__TEMP__${row.id}`, now, row.id])
      }

      for (let i = 0; i < issues.length; i++) {
        const newNo = formatIssueNo(year, i + 1)
        const oldNo = issues[i].issueNo
        db.run('UPDATE issues SET issueNo = ?, updatedAt = ? WHERE id = ?', [newNo, now, issues[i].id])
        if (oldNo !== newNo) {
          fixed++
          changeLines.push(`${oldNo || '(空)'} → ${newNo}`)
        }
      }
      details.push(`${year} 年共 ${issues.length} 条 → ISS-${year}-0001 ~ ISS-${year}-${String(issues.length).padStart(4, '0')}`)
    }

    if (changeLines.length > 20) {
      details.push(...changeLines.slice(0, 20), `… 另有 ${changeLines.length - 20} 条变更未列出`)
    } else {
      details.push(...changeLines)
    }

    return {
      task: 'issueNo',
      message: fixed ? `已重编 ${fixed} 条 Issue 编号` : '编号已是最新顺序',
      details,
      fixed,
    }
  }

  /** 链接关注系数迁移：voided* → attentionLevel，并删除废弃列 */
  repairLinkAttention(): RepairTaskResult {
    if (!tableExists(getDb(), 'issueListLinks')) runSchema(getDb())
    const result = migrateIssueListLinkAttention(getDb(), true)
    const fixed = result.voidedMapped + result.timestampsCopied + (result.voidedColumnsDropped ? 1 : 0)
    const details = [
      `数据映射：${result.voidedMapped} 条`,
      `时间戳复制：${result.timestampsCopied} 条`,
    ]
    if (result.voidedColumnsDropped) {
      details.push('已删除 voided / voidedAt / voidedBy 三列')
    } else {
      details.push('废弃列已不存在，无需删除')
    }
    return {
      task: 'linkAttention',
      message: fixed ? '链接关注系数迁移完成' : '链接关注系数已是最新',
      details,
      fixed,
    }
  }

  runTask(task: RepairTaskId): RepairTaskResult[] {
    switch (task) {
      case 'schema': return [this.repairSchema()]
      case 'checkpoints': return [this.repairCheckpoints()]
      case 'links': return [this.repairIssueListLinks()]
      case 'dict': return [this.repairDict()]
      case 'users': return [this.repairUsers()]
      case 'issueNo': return [this.repairIssueNo()]
      case 'linkAttention': return [this.repairLinkAttention()]
      case 'all':
        return [
          this.repairSchema(),
          this.repairCheckpoints(),
          this.repairIssueListLinks(),
          this.repairDict(),
          this.repairUsers(),
          this.repairIssueNo(),
          this.repairLinkAttention(),
        ]
      default:
        throw Object.assign(new Error(`未知修正任务: ${task}`), { statusCode: 400 })
    }
  }
}

function parseIssueYear(issueNo: string, createdAt: string): number {
  const m = issueNo.match(/^ISS-(\d{4})-/)
  if (m) return parseInt(m[1], 10)
  const y = new Date(createdAt).getFullYear()
  return Number.isFinite(y) ? y : new Date().getFullYear()
}

function formatIssueNo(year: number, seq: number): string {
  return `ISS-${year}-${String(seq).padStart(4, '0')}`
}
