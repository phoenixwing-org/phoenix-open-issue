export const REQUIRED_HOST_SETTING_REUSE = Object.freeze([
  'identity',
  'users',
  'departments',
  'roles',
])

export const ALLOWED_DAILY_REPAIR_TASKS = Object.freeze([
  'checkpoints',
  'links',
  'list-org-references',
])

const hostOwnedRouteSegments = new Set([
  'auth',
  'login',
  'logout',
  'register',
  'oauth',
  'password',
  'passwords',
  'organization',
  'organisation',
  'organizations',
  'organisations',
  'org',
  'orgs',
  'users',
  'departments',
  'roles',
])

const forbiddenStandaloneFile = /(?:^|\/)(?:views\/(?:login|register|oauth-callback|org|organization|settings)|api\/(?:login|register|oauth|password|users?)|core\/types\/(?:external-auth|org-unit))\.(?:ts|vue)$/i

const forbiddenLegacyDeclarations = [
  ['legacy systemRole', /\bsystemRole\b/],
  ['legacy password hash', /\bpasswordHash\b/],
  ['legacy login input', /\b(?:interface|type)\s+LoginInput\b/],
  ['legacy registration result', /\b(?:interface|type)\s+RegisterResult\b/],
  ['legacy password mutation', /\b(?:ChangePasswordInput|AdminResetPasswordInput)\b/],
  ['legacy external auth', /\b(?:ExternalAuthProvider|ExternalIdentity|ExternalBindRequest|LoginPolicy)\w*\b/],
  ['legacy organization tree', /\b(?:interface|type)\s+(?:OrgUnit|OrgTreeNode|OrgUnitType)\b/],
]

function sourceEntries(sources) {
  if (sources instanceof Map) return [...sources.entries()]
  return Object.entries(sources ?? {})
}

function containsHostOwnedRoute(value) {
  if (typeof value !== 'string') return false
  if (/(?:登录|注册|密码|组织架构|用户管理|部门管理|角色管理)/.test(value)) return true
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .some(segment => hostOwnedRouteSegments.has(segment))
}

/**
 * Keep account, login, password, organization and global-role management in
 * Phoenix Admin. Open Issue may consume a minimal Host user projection, but it
 * must not recreate those settings or bypass the Host user-list capability.
 */
export function validateHostOwnedSettingsBoundary({
  manifest,
  sources,
  repairTasks,
}) {
  const errors = []
  const hostReuse = new Set(manifest?.hostReuse ?? [])

  for (const capability of REQUIRED_HOST_SETTING_REUSE) {
    if (!hostReuse.has(capability)) {
      errors.push(`manifest hostReuse 缺少 Host-owned 能力：${capability}`)
    }
  }

  for (const route of manifest?.routes ?? []) {
    if ([route.path, route.title, route.viewPath].some(containsHostOwnedRoute)) {
      errors.push(`插件不得物化 Host 账号/组织设置路由：${route.path ?? route.id}`)
    }
  }

  for (const capability of manifest?.capabilities ?? []) {
    for (const endpoint of capability.endpoints ?? []) {
      if (containsHostOwnedRoute(endpoint.path)) {
        errors.push(`插件不得声明 Host 账号/组织 endpoint：${endpoint.method} ${endpoint.path}`)
      }
    }
  }

  const tasks = [...(repairTasks ?? [])]
  if (JSON.stringify(tasks) !== JSON.stringify(ALLOWED_DAILY_REPAIR_TASKS)) {
    errors.push(`日常 maintenance task 只能是 ${ALLOWED_DAILY_REPAIR_TASKS.join(', ')}：${tasks.join(', ') || '缺失'}`)
  }

  for (const [file, source] of sourceEntries(sources)) {
    const normalizedFile = file.replaceAll('\\', '/')
    if (forbiddenStandaloneFile.test(normalizedFile)) {
      errors.push(`插件交付不得包含 legacy Host 设置文件：${normalizedFile}`)
    }
    for (const [label, pattern] of forbiddenLegacyDeclarations) {
      if (pattern.test(source)) errors.push(`${normalizedFile} 仍声明 ${label}`)
    }

    const canonicalVueUserAdapter = normalizedFile.endsWith('/api/auth.ts')
    if (source.includes('service.base.sys.user') && !canonicalVueUserAdapter) {
      errors.push(`Cool 用户列表只能由集中 Host adapter 读取：${normalizedFile}`)
    }
    if (!canonicalVueUserAdapter && /\bgetAllUsers\s*\(/.test(source) &&
        !source.includes("base:sys:user:list")) {
      errors.push(`Host 用户选择未先消费 Cool base:sys:user:list 权限：${normalizedFile}`)
    }

    const canonicalNodeUserAdapter = normalizedFile.endsWith('/service/host-user.ts')
    if (source.includes('base_sys_user') && !canonicalNodeUserAdapter) {
      errors.push(`Host 用户表只能由集中后端 adapter 读取：${normalizedFile}`)
    }
    if (canonicalNodeUserAdapter &&
        /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+base_sys_user/i.test(source)) {
      errors.push('Issue Host user adapter 必须只读，不得修改 base_sys_user')
    }
  }

  return errors
}
