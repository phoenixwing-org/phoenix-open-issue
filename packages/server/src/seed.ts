import { getAsyncDb } from './db/connection.js'
import {
  generateId,
  normalizeDictTags,
  ISSUE_IMPORTANCE_DICT,
  ISSUE_URGENCY_DICT,
} from '@open-issue/core'
import bcrypt from 'bcryptjs'
import { ensurePendingOrgUnitAsync } from './utils/pendingOrgUnit.js'
import type { PnwDbExecutor } from './db/pnw/pnwDbTypes.js'
import { config } from './config.js'

// ═══════════════════ System Flags ═══════════════════
export async function getSystemFlag(key: string): Promise<string | undefined> {
  const db = getAsyncDb()
  const row = await db.get('SELECT value FROM systemFlags WHERE key = ?', [key]) as { value: string } | undefined
  return row?.value
}

export async function setSystemFlag(
  key: string,
  value: string,
  db: PnwDbExecutor = getAsyncDb(),
): Promise<void> {
  await db.run(
    'INSERT INTO systemFlags (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, value],
  )
}

// ═══════════════════ 数据字典（独立函数，可复用） ═══════════════════
const LIST_TYPE_DICT: { v: string; l: string; tags: string }[] = [
  { v: 'yearly', l: '年度', tags: 'core' },
  { v: 'monthly', l: '月度', tags: 'core' },
  { v: 'project', l: '项目', tags: 'core' },
  { v: 'custom', l: '自定义', tags: 'core' },
  { v: 'personal', l: '个人', tags: 'general' },
  { v: 'group', l: '小组', tags: 'general' },
  { v: 'department', l: '科室', tags: 'general' },
  { v: 'division', l: '部门', tags: 'general' },
  { v: 'company', l: '公司', tags: 'general' },
]

export async function seedListTypeDict(): Promise<number> {
  const db = getAsyncDb()
  let count = 0
  for (const item of LIST_TYPE_DICT) {
    if (await insertDictIfAbsent(db, 'listType', item.v, item.l, item.tags)) count++
  }
  return count
}

/**
 * Issue 的重要度/紧急度是内置四档系统协议。
 * 旧库仍使用 severity/priority 作为字段和分组名；只开放 label 定制，value 不迁移。
 */
export async function seedIssueDimensionDict(): Promise<number> {
  const db = getAsyncDb()
  const groups = [
    { groupName: 'severity', items: ISSUE_IMPORTANCE_DICT },
    { groupName: 'priority', items: ISSUE_URGENCY_DICT },
  ] as const
  const shouldRenameLegacyLabels = await getSystemFlag('migrate_issue_dimensions_v1') !== '1'
  const legacyLabels = new Set([
    '致命', '严重', '轻微', '一般',
    '致命-系统崩溃', '严重-核心不可用', '轻微-部分异常', '一般-体验问题',
    '低', '中', '高', '紧急',
  ])
  let count = 0

  for (const group of groups) {
    for (const [sortOrder, item] of group.items.entries()) {
      const existing = await db.get(
        'SELECT id, label, tags, sortOrder FROM dict WHERE groupName = ? AND value = ?',
        [group.groupName, item.value],
      ) as { id: string; label: string; tags: string; sortOrder: number } | undefined
      if (!existing) {
        if (await insertDictIfAbsent(db, group.groupName, item.value, item.label, 'core,general')) count++
        await db.run(
          'UPDATE dict SET sortOrder = ? WHERE groupName = ? AND value = ?',
          [sortOrder, group.groupName, item.value],
        )
        continue
      }

      // 系统维度标签也是协议的一部分，清理旧 preset 遗留标签。
      const tags = normalizeDictTags('core,general')
      const label = shouldRenameLegacyLabels && legacyLabels.has(existing.label)
        ? item.label
        : existing.label
      if (tags !== normalizeDictTags(existing.tags) || label !== existing.label || existing.sortOrder !== sortOrder) {
        await db.run(
          'UPDATE dict SET label = ?, tags = ?, sortOrder = ? WHERE id = ?',
          [label, tags, sortOrder, existing.id],
        )
      }
    }
  }

  if (shouldRenameLegacyLabels) await setSystemFlag('migrate_issue_dimensions_v1', '1')
  return count
}

async function insertDictIfAbsent(
  db: PnwDbExecutor,
  groupName: string,
  value: string,
  label: string,
  tags: string,
): Promise<boolean> {
  const existing = await db.get(
    'SELECT id FROM dict WHERE groupName = ? AND value = ?',
    [groupName, value],
  ) as { id: string } | undefined
  if (existing) return false

  const maxSort = await db.get(
    'SELECT MAX(sortOrder) as m FROM dict WHERE groupName = ?',
    [groupName],
  ) as { m: number | null }
  const sortOrder = (maxSort?.m ?? -1) + 1
  try {
    await db.run(
      'INSERT INTO dict (id, groupName, value, label, sortOrder, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), groupName, value, label, sortOrder, normalizeDictTags(tags)],
    )
    return true
  } catch {
    // 并发或历史重复：唯一索引 (groupName, value) 冲突时视为已存在
    return false
  }
}

export async function seedDict(): Promise<number> {
  const db = getAsyncDb()
  const dictDefaults: { g: string; tag?: string; items: { v: string; l: string; tags?: string }[] }[] = [
    { g: 'issueCategory', tag: 'automotive', items: [
      { v: 'appearance', l: '外观' }, { v: 'dimension', l: '尺寸' }, { v: 'function', l: '功能' },
      { v: 'process', l: '过程' }, { v: 'safety', l: '安全' }, { v: 'other', l: '其他' },
    ]},
    { g: 'detectionPhase', tag: 'automotive', items: [
      { v: 'incoming', l: '来料检验' }, { v: 'in_process', l: '过程检验' }, { v: 'final', l: '终检' },
      { v: 'customer', l: '客户反馈' }, { v: 'audit', l: '审核发现' }, { v: 'supplier', l: '供应商端' },
    ]},
    { g: 'orgUnitType', tag: 'automotive', items: [
      { v: 'group', l: '小组' }, { v: 'department', l: '科室' }, { v: 'division', l: '部' },
    ]},
    { g: 'closeReason', tag: 'automotive', items: [
      { v: 'completed', l: '已完成' }, { v: 'cancelled', l: '已取消' }, { v: 'duplicate', l: '重复' },
      { v: 'transferred', l: '已转交' }, { v: 'unreproducible', l: '不可复现' },
    ]},
  ]
  let dictCount = 0
  for (const dg of dictDefaults) {
    for (const di of dg.items) {
      const tags = di.tags ?? dg.tag ?? ''
      if (await insertDictIfAbsent(db, dg.g, di.v, di.l, tags)) dictCount++
    }
  }
  dictCount += await seedListTypeDict()
  dictCount += await seedIssueDimensionDict()
  console.log(`  📚 ${dictCount} dict entries seeded`)
  return dictCount
}

// ═══════════════════ 基础种子：admin + 字典（自动执行） ═══════════════════
export async function seedEssential(): Promise<string[]> {
  const db = getAsyncDb()
  const logs: string[] = []

  const existing = await db.get('SELECT COUNT(*) as c FROM users') as { c: number }
  if (existing.c > 0) {
    // 已有用户，只补字典（兼容旧 DB 升级）
    const dictCount = await db.get('SELECT COUNT(*) as c FROM dict') as { c: number }
    if (dictCount.c === 0) {
      await seedDict()
    } else {
      await seedListTypeDict()
      await seedIssueDimensionDict()
    }
    await db.exec("UPDATE users SET systemRole = 'admin' WHERE username = 'admin' AND systemRole != 'admin'")
    return logs
  }

  console.log('🌱 Seeding essential data (admin + dict)...')
  const now = new Date().toISOString()
  const pw = bcrypt.hashSync(config.bootstrapAdminPassword, 10)

  // admin 账号
  await db.run(`INSERT INTO users (id, username, email, passwordHash, displayName, orgUnitId, approved, systemRole, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), 'admin', 'admin@example.com', pw, '管理员', null, 1, 'admin', now, now])
  console.log('  👤 admin account created; password comes from INITIAL_ADMIN_PASSWORD')

  // 字典
  await seedDict()

  // 确保待定组存在
  await ensurePendingOrgUnitAsync(db)

  logs.push('创建 admin（密码来自 INITIAL_ADMIN_PASSWORD）')
  logs.push('初始化数据字典')
  return logs
}

// ═══════════════════ 测试数据：手动触发 ═══════════════════
export async function seedTestData(db: PnwDbExecutor = getAsyncDb()): Promise<string[]> {
  const logs: string[] = []

  // 检查是否已有测试数据
  const existingLists = await db.get('SELECT COUNT(*) as c FROM issueLists') as { c: number }
  if (existingLists.c > 0) {
    logs.push('已有列表数据，跳过测试数据')
    return logs
  }

  console.log('🌱 Seeding test data...')
  const now = new Date().toISOString()
  const pw = bcrypt.hashSync('123456', 10)

  // 查找 admin
  const admin = await db.get("SELECT id FROM users WHERE username = 'admin'") as { id: string } | undefined
  if (!admin) {
    logs.push('未找到 admin 用户，跳过')
    return logs
  }
  const uid_admin = admin.id

  // 测试用户
  const uid_zs = generateId()
  const uid_ls = generateId()
  await db.run(`INSERT INTO users (id, username, email, passwordHash, displayName, orgUnitId, approved, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid_zs, 'zhangsan', 'zs@example.com', pw, '张三', null, 1, now, now])
  await db.run(`INSERT INTO users (id, username, email, passwordHash, displayName, orgUnitId, approved, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid_ls, 'lisi', 'ls@example.com', pw, '李四', null, 1, now, now])
  console.log('  👤 +2 users: zhangsan / lisi (password: 123456)')

  // 组织
  const orgPendingId = await ensurePendingOrgUnitAsync(db)
  const orgDeptId = generateId()
  const orgFrontendId = generateId()
  const orgBackendId = generateId()
  const orgQualityId = generateId()
  await db.run('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)', [orgDeptId, '研发部', 'division', null])
  await db.run('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)', [orgFrontendId, '前端组', 'group', orgDeptId])
  await db.run('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)', [orgBackendId, '后端组', 'group', orgDeptId])
  await db.run('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)', [orgQualityId, '质量部', 'division', null])
  await db.run('UPDATE users SET orgUnitId = ? WHERE id = ?', [orgFrontendId, uid_admin])
  await db.run('UPDATE users SET orgUnitId = ? WHERE id = ?', [orgFrontendId, uid_zs])
  await db.run('UPDATE users SET orgUnitId = ? WHERE id = ?', [orgBackendId, uid_ls])
  console.log('  🏢 5 org units')

  // 列表 1：前端组
  const list1Id = generateId()
  await db.run(`INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [list1Id, '前端组 2026年7月点检', '月度常规检查', 'monthly', uid_admin, orgFrontendId, now, now])
  await db.run('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)', [generateId(), list1Id, uid_admin, 'owner'])
  await db.run('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)', [generateId(), list1Id, uid_zs, 'editor'])

  const i1 = generateId()
  await db.run(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i1, list1Id, 'ISS-2026-0001', '页面加载慢', 'Dashboard 首次加载超过 5s', 'in_progress', 'high', 'major', 'function', 'customer', uid_zs, uid_admin, '2026-07-10', 0, uid_admin, now, now])
  await db.run(`INSERT INTO eightDReports (id, relatedIssueId, title, containment, rootCause, correctiveAction, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), i1, '8D · 页面加载慢', '先加 loading 动画', '未做代码分割，bundle 过大', '配置 Vite code-split + lazy load 路由', uid_admin, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i1, '2026-06-25', '定位性能瓶颈', 'done', uid_admin, 0, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i1, '2026-06-30', '实施 code-split', 'pending', uid_admin, 1, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i1, '2026-07-05', '验证加载时间', 'pending', uid_zs, 2, now, now])

  const i2 = generateId()
  await db.run(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i2, list1Id, 'ISS-2026-0002', '登录页样式错乱', 'iPhone SE 上按钮溢出', 'open', 'medium', 'minor', 'appearance', 'customer', uid_zs, uid_zs, '2026-07-15', 1, uid_zs, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i2, '2026-07-02', '复现问题', 'pending', uid_zs, 0, now, now])
  console.log('  📋 List 1: "前端组 2026年7月点检" — 2 issues')

  // 列表 2：后端组
  const list2Id = generateId()
  await db.run(`INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [list2Id, '后端组 2026年7月点检', '月度常规检查', 'monthly', uid_ls, orgBackendId, now, now])
  await db.run('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)', [generateId(), list2Id, uid_ls, 'owner'])
  await db.run('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)', [generateId(), list2Id, uid_admin, 'editor'])

  const i3 = generateId()
  await db.run(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i3, list2Id, 'ISS-2026-0003', 'API 响应超时', '查询列表接口偶发 5s+ 超时', 'open', 'critical', 'fatal', 'function', 'audit', uid_ls, uid_admin, '2026-07-05', 0, uid_ls, now, now])
  await db.run(`INSERT INTO eightDReports (id, relatedIssueId, title, containment, rootCause, correctiveAction, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), i3, '8D · API 响应超时', '增加查询超时熔断', '数据库写锁竞争', '优化查询 + 加索引 + 连接池', uid_ls, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i3, '2026-06-28', '排查数据库慢查询', 'done', uid_admin, 0, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i3, '2026-07-01', '加索引优化', 'pending', uid_admin, 1, now, now])

  const i4 = generateId()
  await db.run(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i4, list2Id, 'ISS-2026-0004', '数据库备份脚本', '缺少自动备份，存在数据丢失风险', 'in_progress', 'high', 'major', 'process', 'in_process', uid_admin, uid_ls, '2026-07-08', 1, uid_ls, now, now])
  await db.run(`INSERT INTO eightDReports (id, relatedIssueId, title, containment, rootCause, correctiveAction, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), i4, '8D · 数据库备份脚本', '手动每日备份', '未配置自动化', '编写 cron + 同步脚本', uid_ls, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i4, '2026-06-30', '调研备份方案', 'done', uid_ls, 0, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i4, '2026-07-03', '编写备份脚本', 'pending', uid_ls, 1, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i4, '2026-07-06', '验证自动恢复', 'pending', uid_admin, 2, now, now])
  console.log('  📋 List 2: "后端组 2026年7月点检" — 2 issues')

  // 列表 3：质量部
  const list3Id = generateId()
  await db.run(`INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [list3Id, '质量部 Q3 审核问题', 'IATF 16949 内审不符合项跟踪', 'project', uid_admin, orgQualityId, now, now])
  await db.run('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)', [generateId(), list3Id, uid_admin, 'owner'])
  await db.run('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)', [generateId(), list3Id, uid_ls, 'viewer'])

  const i5 = generateId()
  await db.run(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i5, list3Id, 'ISS-2026-0005', '过程审核不符合项 #A12', '未按 WI-OP-003 执行首件检验记录', 'open', 'critical', 'fatal', 'process', 'audit', uid_admin, uid_ls, '2026-07-20', 0, uid_admin, now, now])
  await db.run(`INSERT INTO eightDReports (id, relatedIssueId, title, containment, rootCause, correctiveAction, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), i5, '8D · 过程审核不符合项 #A12', '临时增加检验员复核', '培训不到位 + 记录表格不清晰', '1.全员培训 WI-OP-003  2.更新记录表格为电子版  3.增加班组长抽查', uid_admin, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i5, '2026-07-01', '制定培训计划', 'done', uid_admin, 0, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i5, '2026-07-10', '完成全员培训', 'pending', uid_ls, 1, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i5, '2026-07-15', '更新电子表格上线', 'pending', uid_admin, 2, now, now])
  await db.run('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), i5, '2026-07-20', '内审复查关闭', 'pending', uid_admin, 3, now, now])
  console.log('  📋 List 3: "质量部 Q3 审核问题" — 1 issue (8D)')

  // issueListLinks（seed 用 raw INSERT，需要手动建链接）
  await db.run('INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt) VALUES (?, ?, ?, ?, ?)', [generateId(), i1, list1Id, uid_admin, now])
  await db.run('INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt) VALUES (?, ?, ?, ?, ?)', [generateId(), i2, list1Id, uid_zs, now])
  await db.run('INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt) VALUES (?, ?, ?, ?, ?)', [generateId(), i3, list2Id, uid_ls, now])
  await db.run('INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt) VALUES (?, ?, ?, ?, ?)', [generateId(), i4, list2Id, uid_ls, now])
  await db.run('INSERT INTO issueListLinks (id, issueId, listId, linkedBy, linkedAt) VALUES (?, ?, ?, ?, ?)', [generateId(), i5, list3Id, uid_admin, now])

  // ── poiFunctions 示例数据 ──
  const f1 = generateId()
  const f2 = generateId()
  const f3 = generateId()
  await db.run(`INSERT INTO poiFunctions (id, platform, externalId, functionName, targetYear, clientGroup, developGroup) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [f1, '演示平台', 'DN-001', '用户登录', '2025', '通用', 'NodeJs'])
  await db.run(`INSERT INTO poiFunctions (id, platform, externalId, functionName, targetYear, clientGroup, developGroup) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [f2, '演示平台', 'DN-002', '数据报表', '2025', '管理', 'Python'])
  await db.run(`INSERT INTO poiFunctions (id, platform, externalId, functionName, targetYear, clientGroup, developGroup) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [f3, '移动端', 'MB-001', '扫码签到', '2025', '通用', 'Flutter'])
  // 关联几个 Issue 到功能
  await db.run('UPDATE issues SET functionId = ?, updatedAt = ? WHERE id = ?', [f1, now, i1])
  await db.run('UPDATE issues SET functionId = ?, updatedAt = ? WHERE id = ?', [f1, now, i3])
  await db.run('UPDATE issues SET functionId = ?, updatedAt = ? WHERE id = ?', [f2, now, i4])
  console.log('  📋 3 poiFunctions + 3 issue-function links')

  // 推送演示
  await db.run(`INSERT INTO pushRecords (id, fromListId, toListId, issueId, pushedBy, pushedAt, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), list2Id, list1Id, i4, uid_admin, now, 'pending', '后端组的备份脚本问题，建议前端组也关注'])
  console.log('  📤 1 demo push')

  // 标记已执行
  await setSystemFlag('seedTestData', 'done', db)

  console.log('✅ Test data seeded!')
  logs.push('创建 2 测试用户: zhangsan / lisi (密码: 123456)')
  logs.push('创建 3 列表: 前端组点检, 后端组点检, 质量部Q3审核')
  logs.push('创建 5 条 Issue + 点检 + 1 条演示推送')
  return logs
}

// ═══════════════════ 旧接口兼容：force 模式 ═══════════════════
export async function seedDatabase(force = false): Promise<string[]> {
  const logs: string[] = []

  if (force) logs.push('已忽略 force：数据保护规则禁止清空业务数据')

  logs.push(...await seedEssential())
  logs.push(...await seedTestData())
  return logs
}

// 直接运行时执行（CLI）
const isMain = process.argv[1]?.includes('seed')
if (isMain) {
  await seedDatabase()
}
