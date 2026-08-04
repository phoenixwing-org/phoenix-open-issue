import { readFile, readdir, stat } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_PLUGIN_VUE_ROOT,
  ISSUE_CORE_SOURCE_ROOT,
  ISSUE_CORE_TARGET_ROOT,
  ISSUE_UI_FILE_MAPPINGS,
  ISSUE_UI_NEW_TARGETS,
} from './admin-plugin-ui-files.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const asJson = process.argv.includes('--json')

const PLATFORM_SHELL_FILES = [
  'packages/web/src/App.vue',
  'packages/web/src/main.ts',
  'packages/web/src/router/index.ts',
  'packages/web/src/router/workbenchRoutes.ts',
  'packages/web/src/layout/AppShell.vue',
  'packages/web/src/views/LoginView.vue',
  'packages/web/src/views/OAuthCallbackView.vue',
]

const HOST_ADAPTER_FILES = [
  `${ADMIN_PLUGIN_VUE_ROOT}/adapters/host-user.ts`,
  `${ADMIN_PLUGIN_VUE_ROOT}/api/auth.ts`,
  `${ADMIN_PLUGIN_VUE_ROOT}/api/request.ts`,
  `${ADMIN_PLUGIN_VUE_ROOT}/stores/auth.ts`,
  `${ADMIN_PLUGIN_VUE_ROOT}/layout/workbench/poiViewContributions.ts`,
  `${ADMIN_PLUGIN_VUE_ROOT}/config.ts`,
]

function isCountedSource(file) {
  return /\.(?:ts|vue|json|mjs|sql)$/.test(file)
}

async function listFiles(relativeRoot) {
  const absoluteRoot = path.join(repoRoot, relativeRoot)
  const result = []
  for (const entry of await readdir(absoluteRoot)) {
    if (entry === 'node_modules') continue
    const relative = path.join(relativeRoot, entry)
    const info = await stat(path.join(repoRoot, relative))
    if (info.isDirectory()) result.push(...await listFiles(relative))
    else result.push(relative)
  }
  return result
}

async function summarize(files) {
  const unique = [...new Set(files)].sort()
  let bytes = 0
  let lines = 0
  let nonBlankLines = 0
  for (const file of unique) {
    const content = await readFile(path.join(repoRoot, file), 'utf8')
    bytes += Buffer.byteLength(content)
    const physical = content.length ? content.split(/\r?\n/).length : 0
    lines += physical
    nonBlankLines += content.split(/\r?\n/).filter(line => line.trim()).length
  }
  return { files: unique.length, lines, nonBlankLines, bytes }
}

async function countTestCases(files) {
  let testCases = 0
  for (const file of files) {
    const content = await readFile(path.join(repoRoot, file), 'utf8')
    testCases += [...content.matchAll(/\b(?:it|test)\s*\(/g)].length
  }
  return testCases
}

function auditPack() {
  const cache = path.join(tmpdir(), 'phoenix-open-issue-npm-cache')
  mkdirSync(cache, { recursive: true })
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: path.join(repoRoot, 'packages/admin-plugin'),
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: cache },
  })

  if (result.status !== 0) {
    return {
      compressedPackageBytes: null,
      installedBytes: null,
      entryCount: null,
      bundledDependencies: null,
      note: `npm pack dry-run 失败：${result.stderr.trim() || `exit ${result.status}`}`,
    }
  }

  const pack = JSON.parse(result.stdout)[0]
  return {
    compressedPackageBytes: pack.size,
    installedBytes: pack.unpackedSize,
    entryCount: pack.entryCount,
    bundledDependencies: pack.bundled?.length ?? 0,
    note: '源码交付包 dry-run；包含 Vue、Midway、manifest 与版本化 SQL，不等同于 Host 正式构建产物。',
  }
}

const coreSourceFiles = (await listFiles(ISSUE_CORE_SOURCE_ROOT)).filter(isCountedSource)
const coreTargetFiles = (await listFiles(ISSUE_CORE_TARGET_ROOT)).filter(isCountedSource)
const mappedSourceFiles = ISSUE_UI_FILE_MAPPINGS.map(([source]) => source)
const mappedTargetFiles = [
  ...ISSUE_UI_FILE_MAPPINGS.map(([, target]) => path.join(ADMIN_PLUGIN_VUE_ROOT, target)),
  ...ISSUE_UI_NEW_TARGETS.map(target => path.join(ADMIN_PLUGIN_VUE_ROOT, target)),
]
const uiSourceFiles = mappedSourceFiles.filter(file => file.endsWith('.vue'))
const uiTargetFiles = mappedTargetFiles.filter(file => file.endsWith('.vue'))
const inheritedAlgorithmFiles = coreSourceFiles.filter(file => file.includes('/algorithms/') && !file.endsWith('.test.ts'))
const pluginDomainFiles = (await listFiles('packages/admin-plugin/midway/phoenix-open-issue/domain'))
  .filter(file => file.endsWith('.ts'))
const pluginAlgorithmFiles = [
  ...coreTargetFiles.filter(file => file.includes('/algorithms/') && !file.endsWith('.test.ts')),
  ...pluginDomainFiles,
]
const inheritedTestFiles = coreSourceFiles.filter(file => file.endsWith('.test.ts'))
const pluginFiles = (await listFiles('packages/admin-plugin')).filter(isCountedSource)
const pluginTestFiles = pluginFiles.filter(file => file.endsWith('.test.ts'))
const pluginMigrationFiles = pluginFiles.filter(file => file.endsWith('.sql'))

if (pluginFiles.some(file => file.split(path.sep).includes('node_modules'))) {
  throw new Error('审计源码范围不得包含 node_modules')
}

const metrics = {
  generatedAt: new Date().toISOString(),
  baseline: 'legacy/2cdc5ea',
  definitions: {
    lines: '物理行数（含空行）',
    nonBlankLines: '非空物理行数；不等同于语义 SLOC',
    bytes: 'UTF-8 源文件字节数；不等同于打包或运行时体积',
  },
  legacyBusinessClosure: await summarize([...mappedSourceFiles, ...coreSourceFiles]),
  pluginBusinessClosure: await summarize([...mappedTargetFiles, ...coreTargetFiles]),
  ui: {
    source: await summarize(uiSourceFiles),
    target: await summarize(uiTargetFiles),
    fidelityGate: 'template/style 逐文件严格一致；声明的最小产品修正需通过结构指纹',
  },
  algorithms: {
    inherited: await summarize(inheritedAlgorithmFiles),
    plugin: await summarize(pluginAlgorithmFiles),
  },
  tests: {
    inherited: {
      ...(await summarize(inheritedTestFiles)),
      testCases: await countTestCases(inheritedTestFiles),
    },
    plugin: {
      ...(await summarize(pluginTestFiles)),
      testCases: await countTestCases(pluginTestFiles),
    },
  },
  platformShellNotMigrated: await summarize(PLATFORM_SHELL_FILES),
  hostAdapters: await summarize(HOST_ADAPTER_FILES),
  migrations: await summarize(pluginMigrationFiles),
  pluginSourcePackage: await summarize(pluginFiles),
  delivery: {
    ...auditPack(),
    frontendProductionEvidence: {
      hostCommit: '1a0d5ae',
      routeEntryFiles: 18,
      routeEntryRawBytes: 186774,
      routeEntryGzipBytes: 64000,
      fullDistRawFiles: 38,
      fullDistRawBytes: 293515,
      fullDistGzipFiles: 27,
      fullDistGzipBytes: 101339,
      brotliBytes: null,
    },
  },
}

if (asJson) {
  console.log(JSON.stringify(metrics, null, 2))
} else {
  const row = (label, value) => `| ${label} | ${value.files} | ${value.lines} | ${value.nonBlankLines} | ${value.bytes} |`
  console.log([
    '# Issue 迁移度量快照',
    '',
    `基线：${metrics.baseline}`,
    '',
    '| 范围 | 文件数 | 物理行 | 非空行 | 源码字节 |',
    '| --- | ---: | ---: | ---: | ---: |',
    row('Legacy 业务依赖闭包', metrics.legacyBusinessClosure),
    row('插件业务依赖闭包', metrics.pluginBusinessClosure),
    row('UI View/组件', metrics.ui.target),
    row('继承的 legacy 算法', metrics.algorithms.inherited),
    row('插件当前纯领域/算法', metrics.algorithms.plugin),
    row('继承的算法单元测试', metrics.tests.inherited),
    row('插件当前全部单元测试', metrics.tests.plugin),
    row('未迁移的平台壳', metrics.platformShellNotMigrated),
    row('新增 Host adapter', metrics.hostAdapters),
    row('生产 DDL migration', metrics.migrations),
    row('当前插件源码包', metrics.pluginSourcePackage),
    '',
    `继承的算法测试用例：${metrics.tests.inherited.testCases}`,
    `插件当前全部测试用例：${metrics.tests.plugin.testCases}`,
    `源码交付包：${metrics.delivery.compressedPackageBytes} bytes（解包 ${metrics.delivery.installedBytes} bytes，${metrics.delivery.entryCount} 项，bundled dependencies ${metrics.delivery.bundledDependencies}）`,
    `前端路由入口：${metrics.delivery.frontendProductionEvidence.routeEntryRawBytes} raw / ${metrics.delivery.frontendProductionEvidence.routeEntryGzipBytes} gzip bytes；完整 dist 增量：${metrics.delivery.frontendProductionEvidence.fullDistRawBytes} raw / ${metrics.delivery.frontendProductionEvidence.fullDistGzipBytes} gzip bytes（Host ${metrics.delivery.frontendProductionEvidence.hostCommit}，无 brotli 产物）`,
    '',
    '> 行数是规模指标，不直接代表质量；源码 pack 与 Host production dist 增量采用不同口径，不能相加或互相替代。',
  ].join('\n'))
}
