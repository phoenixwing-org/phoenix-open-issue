import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'utf8')

async function sha256File(filePath) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

function sqliteFileRole(filePath) {
  if (filePath.endsWith('-wal')) return 'wal'
  if (filePath.endsWith('-shm')) return 'shm'
  if (/\.(sqlite|sqlite3|db)$/i.test(filePath)) return 'database'
  throw new Error(`不是受支持的 SQLite 资产文件：${filePath}`)
}

function assertRetentionDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error('retention-until 必须是有效的 YYYY-MM-DD')
  }
}

async function assertSqliteHeader(filePath) {
  const handle = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(SQLITE_HEADER.length)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    if (bytesRead !== header.length || !header.equals(SQLITE_HEADER)) {
      throw new Error(`文件没有 SQLite 3 数据库头：${filePath}`)
    }
  } finally {
    await handle.close()
  }
}

/**
 * Build a read-only archive inventory from explicit absolute file paths.
 * This function never opens SQLite, follows symlinks, scans directories, or writes output files.
 */
export async function inventoryLegacySqlite({ owner, retentionUntil, files, generatedAt }) {
  if (typeof owner !== 'string' || !owner.trim()) throw new Error('必须提供非空 owner')
  assertRetentionDate(retentionUntil)
  if (!Array.isArray(files) || files.length === 0) throw new Error('至少提供一个 SQLite 资产文件')

  const entries = []
  const seen = new Set()
  for (const input of files) {
    if (!path.isAbsolute(input)) throw new Error(`只接受显式绝对路径：${input}`)
    const stat = await lstat(input)
    if (stat.isSymbolicLink()) throw new Error(`拒绝符号链接：${input}`)
    if (!stat.isFile()) throw new Error(`只接受普通文件：${input}`)
    const resolved = await realpath(input)
    if (seen.has(resolved)) throw new Error(`重复资产文件：${resolved}`)
    seen.add(resolved)
    const role = sqliteFileRole(resolved)
    if (role === 'database') await assertSqliteHeader(resolved)
    entries.push({
      path: resolved,
      role,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      sha256: await sha256File(resolved),
    })
  }

  return {
    schemaVersion: 1,
    kind: 'open-issue-legacy-sqlite-inventory',
    generatedAt: generatedAt ?? new Date().toISOString(),
    owner: owner.trim(),
    retentionUntil,
    readOnly: true,
    files: entries.sort((left, right) => left.path.localeCompare(right.path)),
  }
}

function parseArgs(argv) {
  let owner = ''
  let retentionUntil = ''
  const files = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--owner') owner = argv[++index] ?? ''
    else if (arg === '--retention-until') retentionUntil = argv[++index] ?? ''
    else if (arg.startsWith('--')) throw new Error(`未知参数：${arg}`)
    else files.push(arg)
  }
  return { owner, retentionUntil, files }
}

const isMain = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false

if (isMain) {
  try {
    const inventory = await inventoryLegacySqlite(parseArgs(process.argv.slice(2)))
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
