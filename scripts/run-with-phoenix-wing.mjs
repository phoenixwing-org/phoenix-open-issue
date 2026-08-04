import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { resolveOpenIssueLocalWingRoot } from './open-issue-wing-mode.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const openIssueRoot = path.resolve(scriptDir, '..')
const separator = process.argv.indexOf('--')
const checkOnly = process.argv.includes('--check')

if (!checkOnly && separator < 0) {
  console.error('用法：node scripts/run-with-phoenix-wing.mjs [--check] -- <command> [...args]')
  process.exit(2)
}
const wing = resolveOpenIssueLocalWingRoot(openIssueRoot)
console.log(`[Wing][LOCAL] ${wing.root} (${wing.version}@${wing.commit})`)

if (checkOnly) process.exit(0)

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`${command} 被信号 ${signal} 中止`))
      else if (code === 0) resolve()
      else reject(new Error(`${command} 退出码 ${code}`))
    })
  })
}

let tempDir
try {
  await run('pnpm', ['build'], { cwd: wing.root, env: process.env })
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'open-issue-local-wing-'))
  const tsconfigPath = path.join(tempDir, 'tsconfig.web.json')
  await writeFile(tsconfigPath, JSON.stringify({
    extends: path.join(openIssueRoot, 'packages/web/tsconfig.json'),
    compilerOptions: {
      paths: {
        '@/*': [path.join(openIssueRoot, 'packages/web/src/*')],
        'phoenix-wing': [path.join(wing.root, 'dist/index.d.ts')],
      },
    },
  }, null, 2))

  const command = process.argv[separator + 1]
  const args = process.argv.slice(separator + 2)
  await run(command, args, {
    cwd: openIssueRoot,
    env: {
      ...process.env,
      PHOENIX_WING_MODE: 'local',
      PHOENIX_WING_ROOT: wing.root,
      VITE_PHOENIX_WING_SOURCE: 'LOCAL',
      VITE_PHOENIX_WING_VERSION: wing.version,
      OPEN_ISSUE_LOCAL_WING_TSCONFIG: tsconfigPath,
    },
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
}
