import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  cleanOpenIssueWingEnvironment,
  resolveOpenIssueDevelopmentPlan,
} from './admin-plugin-development-mode.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
const checkOnly = process.argv.includes('--check')
if (mode !== 'registry' && mode !== 'local') {
  throw new Error('用法：node scripts/develop-admin-plugin.mjs <registry|local>')
}

const plan = resolveOpenIssueDevelopmentPlan(repositoryRoot, mode)
const { nodeRoot, vueRoot } = plan
const hostEnvironment = {
  ...cleanOpenIssueWingEnvironment(process.env),
  PHOENIX_ADMIN_NODE_ROOT: nodeRoot,
  PHOENIX_ADMIN_VUE_ROOT: vueRoot,
}
const vueEnvironment = mode === 'local'
  ? { ...hostEnvironment, PHOENIX_WING_ROOT: plan.wingRoot }
  : hostEnvironment

const pnpmCommand = process.env.npm_execpath
  ? process.execPath
  : process.platform === 'win32'
    ? (process.env.ComSpec || 'cmd.exe')
    : 'pnpm'
const pnpmPrefix = process.env.npm_execpath
  ? [process.env.npm_execpath]
  : process.platform === 'win32'
    ? ['/d', '/s', '/c', 'pnpm']
    : []
function spawnPnpm(args, options) {
  return spawn(pnpmCommand, [...pnpmPrefix, ...args], options)
}
function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(args, {
      cwd: options.cwd || repositoryRoot,
      env: options.env || hostEnvironment,
      stdio: 'inherit',
      shell: false,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${args.join(' ')} 被 ${signal} 终止`))
      else if (code === 0) resolve()
      else reject(new Error(`${args.join(' ')} 退出码 ${code}`))
    })
  })
}

if (checkOnly) {
  await run([mode === 'local' ? 'wing:local:check' : 'wing:registry:check'], {
    cwd: vueRoot,
    env: vueEnvironment,
  })
  console.log(`[Open Issue][Wing][${mode === 'local' ? 'LOCAL' : 'REGISTRY'}] Host 启动入口检查通过`)
  process.exit(0)
}

if (process.platform === 'win32') {
  await new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(repositoryRoot, 'scripts/mount-admin-plugin-dev.ps1'),
      '-Action', 'Mount', '-VueHostRoot', vueRoot, '-NodeHostRoot', nodeRoot,
    ], { cwd: repositoryRoot, env: hostEnvironment, stdio: 'inherit', shell: false })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`开发挂载被 ${signal} 终止`))
      else if (code === 0) resolve()
      else reject(new Error(`开发挂载退出码 ${code}`))
    })
  })
} else {
  await run(['admin-plugin:mount-dev-host'])
}
console.log(`[Open Issue][Wing][${mode === 'local' ? 'LOCAL' : 'REGISTRY'}] 启动 Phoenix Admin Host`)

const children = [
  spawnPnpm(['dev'], { cwd: nodeRoot, env: hostEnvironment, stdio: 'inherit', shell: false }),
  spawnPnpm([mode === 'local' ? 'wing' : 'dev'], { cwd: vueRoot, env: vueEnvironment, stdio: 'inherit', shell: false }),
]
let stopping = false
function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill(signal)
}
process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))
const result = await Promise.race(children.map(child => new Promise(resolve => {
  child.once('error', error => resolve({ code: 1, error }))
  child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal }))
})))
stop()
if (result.error) console.error(result.error)
process.exitCode = result.code
