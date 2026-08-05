import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const TABLES = [
  'users',
  'externalIdentities',
  'externalBindRequests',
  'orgUnits',
  'issueLists',
  'issueListMembers',
  'issues',
  'issueListLinks',
  'checkpoints',
  'eightDReports',
  'pushRecords',
  'dict',
  'poiFunctions',
]

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stableValue(value[key])]),
    )
  }
  return value
}

function stableJson(value) {
  return JSON.stringify(stableValue(value))
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeRow(table, input) {
  const row = structuredClone(input)
  if (table === 'users') {
    delete row.passwordHash
    delete row.tokenVersion
  }
  if (table === 'checkpoints' && !Object.hasOwn(row, 'deadline')) {
    row.deadline = row.checkpointDate ?? null
  }
  if (table === 'issues') {
    delete row.listCount
    if (typeof row.extensions === 'string') {
      try {
        row.extensions = JSON.parse(row.extensions)
      } catch {
        // Keep malformed legacy text visible as a comparison mismatch.
      }
    }
  }
  return stableValue(row)
}

function normalizedRows(backup, table) {
  const rows = backup.tables?.[table] ?? []
  if (!Array.isArray(rows)) throw new Error(`table ${table} 必须是数组`)
  return rows
    .map(row => normalizeRow(table, row))
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)))
}

function assertBackup(backup, label) {
  if (!backup || backup.version !== 1 || !backup.tables || typeof backup.tables !== 'object') {
    throw new Error(`${label} 不是 Open Issue backup v1`)
  }
  if (backup.exportScope && backup.exportScope !== 'full') {
    throw new Error(`${label} 必须是 full export，不能使用个人可访问范围导出`)
  }
}

function valueSet(rows, field = 'id') {
  return new Set(rows.map(row => row[field]).filter(value => typeof value === 'string' && value))
}

function checkReference(errors, rows, field, targets, label, optional = false) {
  for (const row of rows) {
    const value = row[field]
    if ((value === null || value === undefined || value === '') && optional) continue
    if (!targets.has(value)) errors.push(`${label} 悬空引用：${String(row.id)}.${field}=${String(value)}`)
  }
}

function checkTargetIntegrity(backup) {
  const errors = []
  const tables = Object.fromEntries(TABLES.map(table => [table, backup.tables[table] ?? []]))
  const users = valueSet(tables.users)
  const lists = valueSet(tables.issueLists)
  const issues = valueSet(tables.issues)

  checkReference(errors, tables.issueLists, 'ownerId', users, 'issueLists')
  checkReference(errors, tables.issueListMembers, 'listId', lists, 'issueListMembers')
  checkReference(errors, tables.issueListMembers, 'userId', users, 'issueListMembers')
  checkReference(errors, tables.issues, 'listId', lists, 'issues')
  checkReference(errors, tables.issueListLinks, 'issueId', issues, 'issueListLinks')
  checkReference(errors, tables.issueListLinks, 'listId', lists, 'issueListLinks')
  checkReference(errors, tables.checkpoints, 'issueId', issues, 'checkpoints')
  checkReference(errors, tables.eightDReports, 'relatedIssueId', issues, 'eightDReports', true)
  checkReference(errors, tables.pushRecords, 'fromListId', lists, 'pushRecords')
  checkReference(errors, tables.pushRecords, 'toListId', lists, 'pushRecords', true)
  checkReference(errors, tables.pushRecords, 'issueId', issues, 'pushRecords')

  const linkCounts = new Map()
  const linkKeys = new Set()
  for (const link of tables.issueListLinks) {
    linkCounts.set(link.issueId, (linkCounts.get(link.issueId) ?? 0) + 1)
    const key = `${String(link.issueId)}\0${String(link.listId)}`
    if (linkKeys.has(key)) errors.push(`issueListLinks 重复：${link.issueId}/${link.listId}`)
    linkKeys.add(key)
  }
  for (const issue of tables.issues) {
    if (Number(issue.listCount ?? 0) !== (linkCounts.get(issue.id) ?? 0)) {
      errors.push(`issues.listCount 不一致：${issue.id}`)
    }
  }

  const dictKeys = new Set()
  for (const item of tables.dict) {
    const key = `${String(item.groupName)}\0${String(item.value)}`
    if (dictKeys.has(key)) errors.push(`dict 重复：${item.groupName}/${item.value}`)
    dictKeys.add(key)
  }
  return errors
}

/** Compare two full application exports without connecting to either database. */
export function verifySqlitePgRehearsal(source, target) {
  assertBackup(source, 'SQLite export')
  assertBackup(target, 'PostgreSQL export')
  const errors = []
  const tableResults = []
  const allTables = [...new Set([...TABLES, ...Object.keys(source.tables), ...Object.keys(target.tables)])].sort()
  for (const table of allTables) {
    const sourceRows = normalizedRows(source, table)
    const targetRows = normalizedRows(target, table)
    const sourceHash = sha256Text(stableJson(sourceRows))
    const targetHash = sha256Text(stableJson(targetRows))
    const matches = sourceHash === targetHash
    tableResults.push({
      table,
      sourceRows: sourceRows.length,
      targetRows: targetRows.length,
      sourceHash,
      targetHash,
      matches,
    })
    if (!matches) errors.push(`table ${table} 内容不一致`)
  }
  errors.push(...checkTargetIntegrity(target))
  return { passed: errors.length === 0, tables: tableResults, errors }
}

async function readExplicitJson(filePath, label) {
  if (!path.isAbsolute(filePath)) throw new Error(`${label} 只接受显式绝对路径`)
  const stat = await lstat(filePath)
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} 必须是普通文件且不能是符号链接`)
  if (stat.size > 512 * 1024 * 1024) throw new Error(`${label} 超过 512 MiB 上限`)
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function parseArgs(argv) {
  let sqliteExport = ''
  let postgresExport = ''
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--sqlite-export') sqliteExport = argv[++index] ?? ''
    else if (arg === '--postgres-export') postgresExport = argv[++index] ?? ''
    else throw new Error(`未知参数：${arg}`)
  }
  if (!sqliteExport || !postgresExport) {
    throw new Error('必须同时提供 --sqlite-export 与 --postgres-export')
  }
  return { sqliteExport, postgresExport }
}

const isMain = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2))
    const source = await readExplicitJson(args.sqliteExport, 'SQLite export')
    const target = await readExplicitJson(args.postgresExport, 'PostgreSQL export')
    const result = verifySqlitePgRehearsal(source, target)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!result.passed) process.exitCode = 1
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
