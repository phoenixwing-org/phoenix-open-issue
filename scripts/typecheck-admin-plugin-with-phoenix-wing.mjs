import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveOpenIssueLocalWingRoot } from './open-issue-wing-mode.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const openIssueRoot = path.resolve(scriptDir, '..')
const fixtureDir = path.join(openIssueRoot, 'packages/admin-plugin/vue')
const fixtureConfigPath = path.join(fixtureDir, 'tsconfig.fixture.json')
const vueTsc = path.join(openIssueRoot, '../phoenix-admin-vue/node_modules/.bin/vue-tsc')
const wing = resolveOpenIssueLocalWingRoot(openIssueRoot)

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
  console.log(`[Wing][LOCAL][PLUGIN-TYPECHECK] ${wing.version}@${wing.commit}`)
  await run('pnpm', ['build'], { cwd: wing.root, env: process.env })

  const fixtureConfig = JSON.parse(await readFile(fixtureConfigPath, 'utf8'))
  const distRoot = path.join(wing.root, 'dist')
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'open-issue-plugin-wing-typecheck-'))
  const generatedConfigPath = path.join(tempDir, 'tsconfig.json')
  const generatedConfig = {
    ...fixtureConfig,
    extends: path.join(openIssueRoot, 'tsconfig.base.json'),
    compilerOptions: {
      ...fixtureConfig.compilerOptions,
      baseUrl: fixtureDir,
      paths: {
        ...fixtureConfig.compilerOptions.paths,
        'phoenix-wing': [path.join(distRoot, 'index.d.ts')],
        'phoenix-wing/components/*.vue': [path.join(distRoot, 'components', '*.vue.d.ts')],
        'phoenix-wing/layout/*.vue': [path.join(distRoot, 'layout', '*.vue.d.ts')],
        'phoenix-wing/*': [path.join(distRoot, '*')],
      },
    },
    include: fixtureConfig.include.map((entry) => path.join(fixtureDir, entry)),
  }
  await writeFile(generatedConfigPath, `${JSON.stringify(generatedConfig, null, 2)}\n`)
  await run(vueTsc, ['--noEmit', '-p', generatedConfigPath], {
    cwd: openIssueRoot,
    env: process.env,
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
}
