import { getDb } from './db/connection.js'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'

const db = getDb()

console.log('🌱 Seeding database...')

// 清理旧数据
db.exec('DELETE FROM push_records')
db.exec('DELETE FROM checkpoints')
db.exec('DELETE FROM issues')
db.exec('DELETE FROM issue_list_members')
db.exec('DELETE FROM issue_lists')
db.exec('DELETE FROM users')
db.exec('DELETE FROM org_units')

const now = new Date().toISOString()
const pw = bcrypt.hashSync('123456', 10)

// 用户
const u1 = uuid() // admin
const u2 = uuid() // zhangsan
db.prepare(
  `INSERT INTO users (id, username, email, password_hash, display_name, org_unit_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
).run(u1, 'admin', 'admin@example.com', pw, '管理员', null, now, now)
db.prepare(
  `INSERT INTO users (id, username, email, password_hash, display_name, org_unit_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
).run(u2, 'zhangsan', 'zhangsan@example.com', pw, '张三', null, now, now)

console.log('  2 users created (admin / zhangsan, password: 123456)')

// 组织
const deptId = uuid()
const groupId = uuid()
db.prepare('INSERT INTO org_units (id, name, unit_type, parent_id) VALUES (?, ?, ?, ?)')
  .run(deptId, '研发部', 'division', null)
db.prepare('INSERT INTO org_units (id, name, unit_type, parent_id) VALUES (?, ?, ?, ?)')
  .run(groupId, '前端组', 'group', deptId)
db.prepare('INSERT INTO org_units (id, name, unit_type, parent_id) VALUES (?, ?, ?, ?)')
  .run(uuid(), '后端组', 'group', deptId)

console.log('  3 org units created (研发部 → 前端组, 后端组)')

// 更新用户组织
db.prepare('UPDATE users SET org_unit_id = ? WHERE id = ?').run(groupId, u1)
db.prepare('UPDATE users SET org_unit_id = ? WHERE id = ?').run(groupId, u2)

// Issue List
const listId = uuid()
db.prepare(
  `INSERT INTO issue_lists (id, name, description, list_type, owner_id, org_unit_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
).run(listId, '2026年7月点检', '月度常规检查', 'monthly', u1, groupId, now, now)

// 成员
db.prepare('INSERT INTO issue_list_members (id, list_id, user_id, role) VALUES (?, ?, ?, ?)')
  .run(uuid(), listId, u1, 'owner')
db.prepare('INSERT INTO issue_list_members (id, list_id, user_id, role) VALUES (?, ?, ?, ?)')
  .run(uuid(), listId, u2, 'editor')

// Issues + Checkpoints
const issue1 = uuid()
db.prepare(
  `INSERT INTO issues (id, list_id, title, description, status, priority, sort_order, created_by, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(issue1, listId, '采购服务器', '需要采购 3 台 Dell R750 服务器', 'in_progress', 'high', 0, u1, now, now)

db.prepare(
  `INSERT INTO checkpoints (id, issue_id, checkpoint_date, description, status, responsible_user_id, sort_order, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(uuid(), issue1, '2026-06-24', '已走流程到采购', 'done', u1, 0, now, now)
db.prepare(
  `INSERT INTO checkpoints (id, issue_id, checkpoint_date, description, status, responsible_user_id, sort_order, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(uuid(), issue1, '2026-06-28', '和乙方签订合同', 'pending', u2, 1, now, now)

const issue2 = uuid()
db.prepare(
  `INSERT INTO issues (id, list_id, title, description, status, priority, sort_order, created_by, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(issue2, listId, '部署 CI/CD 环境', '搭建 Jenkins + Harbor + K8s 测试集群', 'open', 'high', 1, u2, now, now)

db.prepare(
  `INSERT INTO checkpoints (id, issue_id, checkpoint_date, description, status, responsible_user_id, sort_order, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(uuid(), issue2, '2026-07-01', '完成环境调研', 'pending', u2, 0, now, now)

const issue3 = uuid()
db.prepare(
  `INSERT INTO issues (id, list_id, title, description, status, priority, sort_order, created_by, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(issue3, listId, '代码审查制度建立', '制定团队代码 Review 流程规范', 'open', 'medium', 2, u1, now, now)

db.prepare(
  `INSERT INTO checkpoints (id, issue_id, checkpoint_date, description, status, responsible_user_id, sort_order, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(uuid(), issue3, '2026-07-05', '草拟 Review 规范文档', 'pending', u1, 0, now, now)

console.log('  1 list created with 3 issues + checkpoints')
console.log('✅ Seed done!')
console.log('   Login: admin / 123456  or  zhangsan / 123456')
