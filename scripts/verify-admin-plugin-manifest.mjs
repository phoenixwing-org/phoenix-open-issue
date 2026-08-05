import { createHash } from 'node:crypto'
import { lstat, readdir, readFile } from 'node:fs/promises'
import {
  extractCreatedTables,
  validatePluginTableContract,
} from './lib/admin-plugin-table-contract.mjs'
import { validateAdminPluginDictionaryContract } from './lib/admin-plugin-dictionary-contract.mjs'

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
const controllerPath = new URL('controller/admin/index.ts', pluginRoot)
const dictAdapterPath = new URL(
  '../packages/admin-plugin/vue/phoenix-open-issue/adapters/host-dict.ts',
  import.meta.url,
)
const capabilityAdapterPath = new URL(
  '../packages/admin-plugin/vue/phoenix-open-issue/core/algorithms/host-capability.ts',
  import.meta.url,
)

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
try {
  const capabilityAdapter = await readFile(capabilityAdapterPath, 'utf8')
  const renderedCapabilityIds = new Set(
    [...capabilityAdapter.matchAll(/'((?:phoenix-open-issue):[a-z-]+:[a-z-]+)'/g)]
      .map(match => match[1]),
  )
  for (const capabilityId of capabilityIds) {
    if (!renderedCapabilityIds.has(capabilityId)) {
      errors.push(`前端 Cool capability adapter 缺少：${capabilityId}`)
    }
  }
  for (const capabilityId of renderedCapabilityIds) {
    if (!capabilityIds.has(capabilityId)) {
      errors.push(`前端声明了 manifest 不存在的 capability：${capabilityId}`)
    }
  }
} catch {
  errors.push('无法读取前端 Cool capability adapter')
}
const endpointMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const declaredEndpointTokens = new Set()
const routeIds = new Set((manifest.routes ?? []).map(item => item.id))
const compatibilityTestRoute = (manifest.routes ?? []).find(
  route => route.path === `${routePrefix}/test-runner`,
)
const maintenanceRoute = (manifest.routes ?? []).find(
  route => route.path === `${routePrefix}/maintenance`,
)
if (maintenanceRoute?.viewPath !== `modules/${moduleId}/views/maintenance.vue`) {
  errors.push('维护与测试统一入口必须由 maintenance.vue 承载')
}
if (compatibilityTestRoute?.viewPath !== `modules/${moduleId}/views/maintenance.vue` ||
    compatibilityTestRoute?.isShow !== false ||
    compatibilityTestRoute?.capability !== `${moduleId}:test:read`) {
  errors.push('旧 test-runner 只能作为指向 maintenance.vue 的隐藏兼容路由')
}
if (manifest.navigation?.preferredGroupId !== 'pah-group-business' ||
    manifest.navigation?.preferredGroupLabel !== '业务') {
  errors.push('插件首次导航必须进入 Host 稳定“业务”组；产品大组只能由管理员手工分配')
}
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
  if (item.id !== manifest.uninstall?.purgeCapability &&
      (!Array.isArray(item.endpoints) || item.endpoints.length === 0)) {
    errors.push(`可调用能力缺少 endpoints：${item.id}`)
  }
  for (const endpoint of item.endpoints ?? []) {
    const token = `${endpoint.method} ${endpoint.path}`
    if (!endpointMethods.has(endpoint.method)) {
      errors.push(`能力 endpoint method 不受支持：${token}`)
    }
    if (typeof endpoint.path !== 'string' ||
        !endpoint.path.startsWith(manifest.apiPrefix) ||
        endpoint.path.includes('..') || endpoint.path.includes('*') ||
        endpoint.path.includes('?') || endpoint.path.includes('#') ||
        endpoint.path.includes(',') || endpoint.path.includes(' ')) {
      errors.push(`能力 endpoint 越界或不安全：${token}`)
    }
    if (declaredEndpointTokens.has(token)) {
      errors.push(`重复能力 endpoint：${token}`)
    }
    declaredEndpointTokens.add(token)
  }
}
const listAdminCapability = (manifest.capabilities ?? []).find(
  item => item.id === `${moduleId}:list:admin`,
)
const listAdminEndpoints = new Set(
  (listAdminCapability?.endpoints ?? []).map(item => `${item.method} ${item.path}`),
)
for (const token of [
  `GET /admin/${moduleId}/lists/all`,
  `GET /admin/${moduleId}/lists/deleted`,
  `PATCH /admin/${moduleId}/list/:id/restore`,
]) {
  if (!listAdminEndpoints.has(token)) errors.push(`全局列表能力缺少 endpoint：${token}`)
}
if (listAdminCapability?.risk !== 'admin') {
  errors.push('跨成员范围查看/恢复列表必须是独立 admin capability')
}

try {
  const controllerSource = await readFile(controllerPath, 'utf8')
  const decoratorMethod = { Get: 'GET', Post: 'POST', Put: 'PUT', Patch: 'PATCH', Del: 'DELETE' }
  const controllerEndpointTokens = new Set()
  for (const match of controllerSource.matchAll(/@(Get|Post|Put|Patch|Del)\(\s*["']([^"']+)["']/g)) {
    controllerEndpointTokens.add(
      `${decoratorMethod[match[1]]} ${manifest.apiPrefix.replace(/\/$/, '')}${match[2]}`,
    )
  }
  for (const token of controllerEndpointTokens) {
    if (!declaredEndpointTokens.has(token)) errors.push(`Controller endpoint 未声明 capability：${token}`)
  }
  for (const token of declaredEndpointTokens) {
    if (!controllerEndpointTokens.has(token)) errors.push(`Capability endpoint 不存在于 Controller：${token}`)
  }
} catch {
  errors.push('无法读取插件 Controller endpoint 清单')
}

let consumedDictionaryTypeKeys = []
try {
  const adapterSource = await readFile(dictAdapterPath, 'utf8')
  consumedDictionaryTypeKeys = [
    ...adapterSource.matchAll(/:\s*'(phoenix-open-issue\.[a-zA-Z][a-zA-Z0-9]*)'/g),
  ].map(match => match[1])
} catch {
  errors.push('无法读取插件 Host 字典 adapter')
}
errors.push(...validateAdminPluginDictionaryContract({
  moduleId,
  hostReuse: manifest.hostReuse,
  dictionaryContributions: manifest.dictionaryContributions,
  consumedTypeKeys: consumedDictionaryTypeKeys,
}))

const migrations = Array.isArray(manifest.migrations) ? manifest.migrations : []
const migrationIds = new Set()
const migrationVersions = new Set()
const declaredMigrationPaths = new Set()
const migrationTables = []
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
    migrationTables.push(...extractCreatedTables(content.toString('utf8')))
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
if (ownedTables.size !== (manifest.dataOwnership?.tables ?? []).length) {
  errors.push('插件 dataOwnership 存在重复表')
}
for (const table of ownedTables) {
  if (!/^oip_[a-z0-9_]+$/.test(table)) errors.push(`插件数据表越界：${table}`)
}
if (manifest.dataOwnership?.retainedOnUninstall !== true ||
    manifest.uninstall?.retainDataByDefault !== true) {
  errors.push('插件卸载必须默认保留业务数据')
}
if (!manifest.hostReuse?.includes('backup') || manifest.uninstall?.requiresBackup !== true) {
  errors.push('插件清除边界必须复用 Host backup 并要求可验证备份')
}
const purgeCapability = (manifest.capabilities ?? []).find(
  item => item.id === manifest.uninstall?.purgeCapability,
)
if (!purgeCapability || purgeCapability.risk !== 'admin' || (purgeCapability.endpoints?.length ?? 0) > 0) {
  errors.push('永久清除必须保持为未暴露 endpoint 的 admin 能力')
}

const entityTables = new Set()
for (const entry of await readdir(entityDirectory)) {
  if (!entry.endsWith('.ts')) continue
  const source = await readFile(new URL(entry, entityDirectory), 'utf8')
  for (const match of source.matchAll(/@Entity\(["']([^"']+)["']\)/g)) {
    entityTables.add(match[1])
  }
}
errors.push(...validatePluginTableContract({ ownedTables, entityTables, migrationTables }))

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Manifest 合法：${moduleId}（产品路由 ${routePrefix}，SQL 迁移 ${migrations.length}）`)
}
