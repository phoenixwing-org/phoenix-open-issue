import { createHash } from 'node:crypto'
import { lstat, readdir, readFile } from 'node:fs/promises'

const manifestPath = new URL('../packages/admin-plugin/manifest.json', import.meta.url)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const errors = []
const moduleId = typeof manifest.moduleId === 'string' ? manifest.moduleId : ''
const iconIdPattern = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._-]*$/
const routePrefix = typeof manifest.routePrefix === 'string'
  ? manifest.routePrefix
  : `/${moduleId}`
const entityDirectory = new URL('../packages/admin-plugin/midway/phoenix-open-issue/entity/', import.meta.url)
const pluginRoot = new URL('../packages/admin-plugin/midway/phoenix-open-issue/', import.meta.url)
const migrationDirectory = new URL('migrations/', pluginRoot)
const artifactDescriptorPath = new URL('pah-plugin.artifacts.json', pluginRoot)

if (manifest.formatVersion !== 2) {
  errors.push(`formatVersion 必须与 Pah SQL v1 契约一致：${manifest.formatVersion}`)
}

try {
  const descriptor = JSON.parse(await readFile(artifactDescriptorPath, 'utf8'))
  if (descriptor.formatVersion !== 1 ||
      descriptor.moduleId !== moduleId ||
      descriptor.version !== manifest.version) {
    errors.push('Pah 编译制品描述符与 manifest 不匹配')
  }
} catch {
  errors.push('缺少或无法解析 Pah 编译制品描述符')
}

if (!/^[a-z][a-z0-9-]*$/.test(moduleId)) errors.push(`非法 moduleId：${moduleId}`)
if (!/^\/[a-z][a-z0-9-]*$/.test(routePrefix)) {
  errors.push(`routePrefix 必须是单段短路径：${routePrefix}`)
}
if (manifest.apiPrefix !== `/admin/${moduleId}/`) {
  errors.push(`apiPrefix 必须是 /admin/${moduleId}/`)
}

const capabilityIds = new Set((manifest.capabilities ?? []).map(item => item.id))
const routeIds = new Set((manifest.routes ?? []).map(item => item.id))
for (const route of manifest.routes ?? []) {
  if (!route.id?.startsWith(`${moduleId}-`)) errors.push(`路由 ID 越界：${route.id}`)
  if (route.path !== routePrefix && !route.path?.startsWith(`${routePrefix}/`)) {
    errors.push(`路由路径越界：${route.path}`)
  }
  if (!route.moduleId?.startsWith(`${moduleId}-`)) {
    errors.push(`路由导航模块越界：${route.moduleId}`)
  }
  if (!route.capability?.startsWith(`${moduleId}:`)) {
    errors.push(`路由能力码越界：${route.capability}`)
  }
  if (!capabilityIds.has(route.capability)) {
    errors.push(`路由引用未声明能力码：${route.capability}`)
  }
  if (!route.viewPath?.startsWith(`modules/${moduleId}/`) || !route.viewPath.endsWith('.vue')) {
    errors.push(`路由视图越界：${route.viewPath}`)
  }
  if (!iconIdPattern.test(route.icon ?? '')) {
    errors.push(`路由图标必须使用显式命名空间：${route.icon}`)
  }
}

for (const item of manifest.capabilities ?? []) {
  if (!item.id?.startsWith(`${moduleId}:`)) errors.push(`能力码越界：${item.id}`)
}

const migrations = Array.isArray(manifest.migrations) ? manifest.migrations : []
const migrationIds = new Set()
const migrationVersions = new Set()
const declaredMigrationPaths = new Set()
for (const migration of migrations) {
  if (!migration?.id?.startsWith(`${moduleId}-`)) {
    errors.push(`迁移 ID 越界：${migration?.id}`)
  }
  if (migrationIds.has(migration?.id)) errors.push(`重复迁移 ID：${migration?.id}`)
  migrationIds.add(migration?.id)
  if (!Number.isInteger(migration?.version) || migration.version < 1) {
    errors.push(`迁移版本必须是正整数：${migration?.id}`)
  }
  if (migrationVersions.has(migration?.version)) {
    errors.push(`重复迁移版本：${migration?.version}`)
  }
  migrationVersions.add(migration?.version)
  if (!/^sha256:[a-f0-9]{64}$/.test(migration?.checksum ?? '')) {
    errors.push(`迁移校验和格式错误：${migration?.id}`)
  }
  if (!migration?.description?.trim()) errors.push(`缺少迁移说明：${migration?.id}`)
  if (migration?.artifact?.format !== 'sql') {
    errors.push(`迁移制品格式不受支持：${migration?.id}`)
  }
  const artifactPath = migration?.artifact?.path
  if (!/^migrations\/[a-z0-9][a-z0-9._/-]*\.sql$/.test(artifactPath ?? '') ||
      artifactPath.includes('..') || artifactPath.includes('\\')) {
    errors.push(`迁移制品路径不安全：${artifactPath}`)
    continue
  }
  if (declaredMigrationPaths.has(artifactPath)) {
    errors.push(`重复迁移制品路径：${artifactPath}`)
  }
  declaredMigrationPaths.add(artifactPath)
  const artifactUrl = new URL(artifactPath, pluginRoot)
  try {
    const stat = await lstat(artifactUrl)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) {
      errors.push(`迁移制品类型或大小不受支持：${artifactPath}`)
      continue
    }
    const content = await readFile(artifactUrl)
    const checksum = `sha256:${createHash('sha256').update(content).digest('hex')}`
    if (checksum !== migration.checksum) {
      errors.push(`迁移制品校验和不匹配：${artifactPath}`)
    }
  } catch {
    errors.push(`迁移制品不存在：${artifactPath}`)
  }
}

let packagedMigrationPaths = []
try {
  packagedMigrationPaths = (await readdir(migrationDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => `migrations/${entry.name}`)
    .sort()
} catch {
  if (migrations.length > 0) errors.push('缺少 migrations 制品目录')
}
if (JSON.stringify(packagedMigrationPaths) !== JSON.stringify([...declaredMigrationPaths].sort())) {
  errors.push('迁移声明与 SQL 制品不是一一对应')
}
for (const item of manifest.navigation?.modules ?? []) {
  if (!item.id?.startsWith(`${moduleId}-`)) errors.push(`导航模块 ID 越界：${item.id}`)
  if (!iconIdPattern.test(item.icon ?? '')) {
    errors.push(`导航模块图标必须使用显式命名空间：${item.icon}`)
  }
  for (const routeId of item.routeIds ?? []) {
    if (!routeIds.has(routeId)) errors.push(`导航引用未知路由：${routeId}`)
  }
}
if (!manifest.uninstall?.purgeCapability?.startsWith(`${moduleId}:`)) {
  errors.push('永久清除能力码不属于插件命名空间')
}

const ownedTables = new Set(manifest.dataOwnership?.tables ?? [])
for (const entry of await readdir(entityDirectory)) {
  if (!entry.endsWith('.ts')) continue
  const source = await readFile(new URL(entry, entityDirectory), 'utf8')
  for (const match of source.matchAll(/@Entity\(["']([^"']+)["']\)/g)) {
    if (!ownedTables.has(match[1])) errors.push(`实体表未声明为插件数据：${match[1]}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Manifest 合法：${moduleId}（产品路由 ${routePrefix}，SQL 迁移 ${migrations.length}）`)
}
