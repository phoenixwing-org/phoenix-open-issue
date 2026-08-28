import { execFile } from 'node:child_process'
import {
  lstat,
  mkdir,
  readFile,
  readlink,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRoot = process.cwd()
const action = process.argv[2] || 'mount'
const allowedActions = new Set(['mount', 'status', 'unmount'])

if (!allowedActions.has(action)) {
  throw new Error(`未知操作：${action}；只支持 mount、status、unmount`)
}

const moduleId = 'phoenix-open-issue'
const mounts = [
  {
    label: 'Vue Host',
    hostRoot: resolve(
      repositoryRoot,
      process.env.PHOENIX_ADMIN_VUE_ROOT || '../phoenix-admin-vue',
    ),
    source: resolve(
      repositoryRoot,
      'packages/admin-plugin/vue/phoenix-open-issue',
    ),
  },
  {
    label: 'Node Host',
    hostRoot: resolve(
      repositoryRoot,
      process.env.PHOENIX_ADMIN_NODE_ROOT || '../phoenix-admin-node',
    ),
    source: resolve(
      repositoryRoot,
      'packages/admin-plugin/midway/phoenix-open-issue',
    ),
  },
].map(item => ({
  ...item,
  target: resolve(item.hostRoot, `src/modules/${moduleId}`),
}))
const markerStart = `# >>> ${moduleId} admin-plugin dev mount >>>`
const markerEnd = `# <<< ${moduleId} admin-plugin dev mount <<<`

async function pathState(path) {
  try {
    return await lstat(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

async function gitPath(hostRoot, name) {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--git-path', name], {
    cwd: hostRoot,
  })
  const path = stdout.trim()
  return isAbsolute(path) ? path : resolve(hostRoot, path)
}

function withoutManagedBlock(content) {
  const lines = content.split(/\r?\n/)
  const next = []
  let managed = false

  for (const line of lines) {
    if (line === markerStart) {
      managed = true
      continue
    }
    if (line === markerEnd) {
      managed = false
      continue
    }
    if (!managed) next.push(line)
  }

  return next.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

async function updateLocalExclude(mount, enabled) {
  const excludePath = await gitPath(mount.hostRoot, 'info/exclude')
  let content = ''
  try {
    content = await readFile(excludePath, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const base = withoutManagedBlock(content)
  const pattern = `/${relative(mount.hostRoot, mount.target).replaceAll('\\', '/')}`
  const block = `${markerStart}\n${pattern}\n${markerEnd}`
  const next = enabled
    ? `${base}${base ? '\n\n' : ''}${block}\n`
    : `${base}${base ? '\n' : ''}`

  await mkdir(dirname(excludePath), { recursive: true })
  await writeFile(excludePath, next, 'utf8')
  return { excludePath, pattern }
}

async function inspectMount(mount) {
  const current = await pathState(mount.target)
  if (!current) return { state: 'missing' }
  if (!current.isSymbolicLink()) return { state: 'occupied' }

  const value = await readlink(mount.target)
  const actual = resolve(dirname(mount.target), value)
  return {
    state: actual === mount.source ? 'mounted' : 'foreign-link',
    value,
    actual,
  }
}

async function mountOne(mount) {
  if (!(await pathState(mount.source))) {
    throw new Error(`${mount.label} 插件源码不存在：${mount.source}`)
  }
  if (!(await pathState(mount.hostRoot))) {
    throw new Error(`${mount.label} 仓库不存在：${mount.hostRoot}`)
  }

  const state = await inspectMount(mount)
  if (state.state === 'occupied') {
    throw new Error(`拒绝覆盖真实目录或文件：${mount.target}`)
  }
  if (state.state === 'foreign-link') {
    throw new Error(`拒绝覆盖其他开发链接：${mount.target} -> ${state.value}`)
  }
  if (state.state === 'missing') {
    await mkdir(dirname(mount.target), { recursive: true })
    await symlink(relative(dirname(mount.target), mount.source), mount.target, 'dir')
  }

  const localExclude = await updateLocalExclude(mount, true)
  console.log(`${mount.label} 已挂载：${mount.target} -> ${mount.source}`)
  console.log(`  本机 Git 排除：${localExclude.excludePath} (${localExclude.pattern})`)
}

async function unmountOne(mount) {
  const state = await inspectMount(mount)
  if (state.state === 'occupied') {
    throw new Error(`拒绝删除真实目录或文件：${mount.target}`)
  }
  if (state.state === 'foreign-link') {
    throw new Error(`拒绝删除其他开发链接：${mount.target} -> ${state.value}`)
  }
  if (state.state === 'mounted') await unlink(mount.target)

  await updateLocalExclude(mount, false)
  console.log(`${mount.label} 已卸载本地链接：${mount.target}`)
}

async function statusOne(mount) {
  const state = await inspectMount(mount)
  const label = {
    missing: '未挂载',
    occupied: '被真实目录或文件占用',
    mounted: '已正确挂载',
    'foreign-link': `指向其他源码：${state.actual}`,
  }[state.state]
  console.log(`${mount.label}：${label}`)
  console.log(`  ${mount.target}`)
  if (state.state !== 'mounted') process.exitCode = 1
}

for (const mount of mounts) {
  if (action === 'mount') await mountOne(mount)
  if (action === 'unmount') await unmountOne(mount)
  if (action === 'status') await statusOne(mount)
}

if (action === 'mount') {
  console.log('挂载只影响本机工作区；重启 Phoenix Admin Vue/Node 后生效。')
  console.log('下一步在 /phoenix/plugins 登记、安装并启用 packages/admin-plugin/manifest.json。')
}
