import { readdir, readFile } from 'node:fs/promises'

const manifestPath = new URL('../packages/admin-plugin/manifest.json', import.meta.url)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const errors = []
const moduleId = typeof manifest.moduleId === 'string' ? manifest.moduleId : ''
const iconIdPattern = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._-]*$/
const routePrefix = typeof manifest.routePrefix === 'string'
  ? manifest.routePrefix
  : `/${moduleId}`
const entityDirectory = new URL('../packages/admin-plugin/midway/phoenix-open-issue/entity/', import.meta.url)

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
  console.log(`Manifest 合法：${moduleId}（产品路由 ${routePrefix}）`)
}
