import { getDb } from './db/connection.js'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'

export function seedDatabase(force = false): string[] {
  const db = getDb()
  const logs: string[] = []

  // 已有数据且非强制 → 跳过
  const existingUsers = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
  if (existingUsers.c > 0 && !force) {
    console.log('🌱 Database already has data, skipping seed.')
    logs.push('数据库已有数据，跳过')
    return logs
  }

  // 强制模式：清空
  if (force) {
    db.exec('DELETE FROM pushRecords')
    db.exec('DELETE FROM checkpoints')
    db.exec('DELETE FROM issues')
    db.exec('DELETE FROM issueListMembers')
    db.exec('DELETE FROM issueLists')
    db.exec('DELETE FROM users')
    db.exec('DELETE FROM orgUnits')
    logs.push('已清空旧数据')
  }

  console.log('🌱 Seeding database...')

const now = new Date().toISOString()
const pw = bcrypt.hashSync('123456', 10)

// ═══════ 用户 ═══════
const uid_admin = uuid()
const uid_zs = uuid()    // 张三
const uid_ls = uuid()    // 李四

db.prepare(`INSERT INTO users (id, username, email, passwordHash, displayName, orgUnitId, approved, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(uid_admin, 'admin', 'admin@example.com', pw, '管理员', null, 1, now, now)
db.prepare(`INSERT INTO users (id, username, email, passwordHash, displayName, orgUnitId, approved, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(uid_zs, 'zhangsan', 'zs@example.com', pw, '张三', null, 1, now, now)
db.prepare(`INSERT INTO users (id, username, email, passwordHash, displayName, orgUnitId, approved, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(uid_ls, 'lisi', 'ls@example.com', pw, '李四', null, 1, now, now)
console.log('  👤 3 users: admin / zhangsan / lisi  (password: 123456)')

// ═══════ 组织 ═══════
const orgPendingId = uuid()
const orgDeptId = uuid()
const orgFrontendId = uuid()
const orgBackendId = uuid()
const orgQualityId = uuid()

db.prepare('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)')
  .run(orgPendingId, '待定组', 'group', null)
db.prepare('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)')
  .run(orgDeptId, '研发部', 'division', null)
db.prepare('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)')
  .run(orgFrontendId, '前端组', 'group', orgDeptId)
db.prepare('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)')
  .run(orgBackendId, '后端组', 'group', orgDeptId)
db.prepare('INSERT INTO orgUnits (id, name, unitType, parentId) VALUES (?, ?, ?, ?)')
  .run(orgQualityId, '质量部', 'division', null)
console.log('  🏢 5 org units: 待定组, 研发部→前端组/后端组, 质量部')

// 用户归属
db.prepare('UPDATE users SET orgUnitId = ? WHERE id = ?').run(orgFrontendId, uid_admin)
db.prepare('UPDATE users SET orgUnitId = ? WHERE id = ?').run(orgFrontendId, uid_zs)
db.prepare('UPDATE users SET orgUnitId = ? WHERE id = ?').run(orgBackendId, uid_ls)

// ═══════ 列表 1：前端组 7月点检 ═══════
const list1Id = uuid()
db.prepare(`INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(list1Id, '前端组 2026年7月点检', '月度常规检查', 'monthly', uid_admin, orgFrontendId, now, now)

// 成员
db.prepare('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)').run(uuid(), list1Id, uid_admin, 'owner')
db.prepare('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)').run(uuid(), list1Id, uid_zs, 'editor')

// Issues — 前端组
const i1 = uuid()
db.prepare(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, containment, rootCause, correctiveAction, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(i1, list1Id, 'ISS-2026-0001', '页面加载慢', 'Dashboard 首次加载超过 5s', 'in_progress', 'high', 'major', 'function', 'customer', uid_zs, uid_admin, '2026-07-10', '先加 loading 动画', '未做代码分割，bundle 过大', '配置 Vite code-split + lazy load 路由', 0, uid_admin, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i1, '2026-06-25', '定位性能瓶颈', 'done', uid_admin, 0, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i1, '2026-06-30', '实施 code-split', 'pending', uid_admin, 1, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i1, '2026-07-05', '验证加载时间', 'pending', uid_zs, 2, now, now)

const i2 = uuid()
db.prepare(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, containment, rootCause, correctiveAction, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(i2, list1Id, 'ISS-2026-0002', '登录页样式错乱', 'iPhone SE 上按钮溢出', 'open', 'medium', 'minor', 'appearance', 'customer', uid_zs, uid_zs, '2026-07-15', null, null, null, 1, uid_zs, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i2, '2026-07-02', '复现问题', 'pending', uid_zs, 0, now, now)

console.log('  📋 List 1: "前端组 2026年7月点检" — owner: admin, editor: 张三, 2 issues')

// ═══════ 列表 2：后端组 7月点检 ═══════
const list2Id = uuid()
db.prepare(`INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(list2Id, '后端组 2026年7月点检', '月度常规检查', 'monthly', uid_ls, orgBackendId, now, now)

db.prepare('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)').run(uuid(), list2Id, uid_ls, 'owner')
db.prepare('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)').run(uuid(), list2Id, uid_admin, 'editor')  // admin 也是后端组成员，用于推送演示

const i3 = uuid()
db.prepare(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, containment, rootCause, correctiveAction, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(i3, list2Id, 'ISS-2026-0001', 'API 响应超时', '查询列表接口偶发 5s+ 超时', 'open', 'critical', 'fatal', 'function', 'audit', uid_ls, uid_admin, '2026-07-05', '增加查询超时熔断', 'SQLite WAL 锁竞争', '优化查询 + 加索引 + 连接池', 0, uid_ls, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i3, '2026-06-28', '排查数据库慢查询', 'done', uid_admin, 0, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i3, '2026-07-01', '加索引优化', 'pending', uid_admin, 1, now, now)

const i4 = uuid()
db.prepare(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, containment, rootCause, correctiveAction, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(i4, list2Id, 'ISS-2026-0002', '数据库备份脚本', '缺少自动备份，存在数据丢失风险', 'in_progress', 'high', 'major', 'process', 'in_process', uid_admin, uid_ls, '2026-07-08', '手动每日备份', '未配置自动化', '编写 cron + 同步脚本', 1, uid_ls, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i4, '2026-06-30', '调研备份方案', 'done', uid_ls, 0, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i4, '2026-07-03', '编写备份脚本', 'pending', uid_ls, 1, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i4, '2026-07-06', '验证自动恢复', 'pending', uid_admin, 2, now, now)

console.log('  📋 List 2: "后端组 2026年7月点检" — owner: 李四, editor: admin, 2 issues')

// ═══════ 列表 3：质量部 Q3 审核 ═══════
const list3Id = uuid()
db.prepare(`INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(list3Id, '质量部 Q3 审核问题', 'IATF 16949 内审不符合项跟踪', 'project', uid_admin, orgQualityId, now, now)

db.prepare('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)').run(uuid(), list3Id, uid_admin, 'owner')
db.prepare('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)').run(uuid(), list3Id, uid_ls, 'viewer')

const i5 = uuid()
db.prepare(`INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase, reporterId, assigneeId, dueDate, containment, rootCause, correctiveAction, sortOrder, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(i5, list3Id, 'ISS-2026-0001', '过程审核不符合项 #A12', '未按 WI-OP-003 执行首件检验记录', 'open', 'critical', 'fatal', 'process', 'audit', uid_admin, uid_ls, '2026-07-20', '临时增加检验员复核', '培训不到位 + 记录表格不清晰', '1.全员培训 WI-OP-003  2.更新记录表格为电子版  3.增加班组长抽查', 0, uid_admin, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i5, '2026-07-01', '制定培训计划', 'done', uid_admin, 0, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i5, '2026-07-10', '完成全员培训', 'pending', uid_ls, 1, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i5, '2026-07-15', '更新电子表格上线', 'pending', uid_admin, 2, now, now)
db.prepare('INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(uuid(), i5, '2026-07-20', '内审复查关闭', 'pending', uid_admin, 3, now, now)

console.log('  📋 List 3: "质量部 Q3 审核问题" — owner: admin, viewer: 李四, 1 issue (8D 完整)')

// ═══════ 推送演示数据 ═══════
// admin 从「后端组」推送一条 issue 到「前端组」（admin 是两个列表的共同成员）
const pushId = uuid()
db.prepare(`INSERT INTO pushRecords (id, fromListId, toListId, issueId, pushedBy, pushedAt, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(pushId, list2Id, list1Id, i4, uid_admin, now, 'pending', '后端组的备份脚本问题，建议前端组也关注')

console.log('  📤 1 demo push: "数据库备份脚本" from 后端组 → 前端组 (admin 发起，待审批)')
console.log('')
console.log('✅ Seed done!')
console.log('   👤 admin    / 123456  — 前端组, 列表 owner')
console.log('   👤 zhangsan / 123456  — 前端组, 列表 editor')
console.log('   👤 lisi     / 123456  — 后端组, 列表 owner')
console.log('')
console.log('   📋 前端组 2026年7月点检 — 2 issues (admin+张三)')
console.log('   📋 后端组 2026年7月点检 — 2 issues (李四+admin)')
console.log('   📋 质量部 Q3 审核问题 — 1 issue 8D (admin+李四)')
console.log('')
console.log('   🧪 测试推送: admin 登录 → 点「后端组 7月点检」→ 收到 1 条待审批推送')

  logs.push('创建 3 用户: admin / zhangsan / lisi (密码: 123456)')
  logs.push('创建 3 列表: 前端组点检, 后端组点检, 质量部Q3审核')
  logs.push('创建 5 条 Issue + 点检 + 1 条演示推送')
  return logs
}

// 直接运行时执行（CLI）
const isMain = process.argv[1]?.includes('seed')
if (isMain) {
  seedDatabase()
  process.exit(0)
}
