import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)
export const pluginRoot = path.join(repoRoot, 'packages/admin-plugin')

const normalizedTime = new Date('1980-01-01T00:00:00.000Z')
const forbiddenPackagePath = /(^|\/)(?:node_modules|test|tests|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|(^|\/)(?:vitest\.config|tsconfig\.fixture)|(^|\/)controlled-test-suite\.json$/
const phoenixPackageExtension = '.phoenix.cool'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
  utimesSync(file, normalizedTime, normalizedTime)
}

function safeRelativePath(value, label = '制品路径') {
  if (
    typeof value !== 'string' ||
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some(part => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${label}不安全：${value}`)
  }
  return value
}

function walkFiles(root, current = '') {
  const files = []
  for (const entry of readdirSync(path.join(root, current), { withFileTypes: true })) {
    const relative = current ? `${current}/${entry.name}` : entry.name
    const absolute = path.join(root, relative)
    const stat = lstatSync(absolute)
    if (stat.isSymbolicLink()) throw new Error(`制品禁止符号链接：${relative}`)
    if (stat.isDirectory()) files.push(...walkFiles(root, relative))
    else if (stat.isFile()) files.push(relative)
    else throw new Error(`制品文件类型不受支持：${relative}`)
  }
  return files.sort()
}

function copyNormalized(source, target) {
  const stat = lstatSync(source)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`打包输入必须是普通文件：${source}`)
  }
  mkdirSync(path.dirname(target), { recursive: true })
  copyFileSync(source, target)
  utimesSync(target, normalizedTime, normalizedTime)
}

function run(command, args, options = {}) {
  const stdio = options.input === undefined
    ? ['ignore', 'pipe', 'pipe']
    : ['pipe', 'pipe', 'pipe']
  return execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio,
    ...options,
  })
}

function gitValue(args, cwd = repoRoot) {
  return run('git', args, { cwd }).trim()
}

function npmPackFiles() {
  const cache = mkdtempSync(path.join(tmpdir(), 'open-issue-cool-pack-cache-'))
  try {
    const raw = run(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['pack', '--dry-run', '--json', '--cache', cache],
      {
        cwd: pluginRoot,
        env: { ...process.env, npm_config_update_notifier: 'false' },
      },
    )
    const [report] = JSON.parse(raw)
    return report.files.map(file => safeRelativePath(file.path)).sort()
  } finally {
    rmSync(cache, { recursive: true, force: true })
  }
}

function productionMetadata(manifest, packageJson, sourceCommit, dirty) {
  const dictionaryTypeKeys = (manifest.dictionaryContributions ?? []).map(
    item => item.typeKey,
  )
  return {
    formatVersion: 1,
    kind: 'pah-business-module',
    key: manifest.moduleId,
    moduleId: manifest.moduleId,
    name: manifest.name,
    version: manifest.version,
    publisher: manifest.publisher,
    description: packageJson.description,
    license: manifest.license,
    activationMode: manifest.activationMode,
    manifest: 'manifest.json',
    integrity: 'integrity.json',
    source: {
      repository: packageJson.repository?.url ?? null,
      commit: sourceCommit,
      dirty,
    },
    hostCompatibility: {
      peerDependencies: packageJson.peerDependencies ?? {},
    },
    installerCompatibility: {
      pahBusinessModule: true,
      coolNativeHook: false,
    },
    payloads: [
      {
        runtime: 'node',
        source: `payload/node/${manifest.moduleId}`,
        target: `src/modules/${manifest.moduleId}`,
      },
      {
        runtime: 'vue',
        source: `payload/vue/${manifest.moduleId}`,
        target: `src/modules/${manifest.moduleId}`,
      },
    ],
    lifecycle: {
      manager: 'pah',
      installMode: 'controlled-build-restart',
      requiresTrustedBackup: manifest.uninstall?.requiresBackup === true,
      uninstall: {
        retainBusinessData: manifest.dataOwnership?.retainedOnUninstall === true,
        retainedTables: manifest.dataOwnership?.tables ?? [],
        retainDictionary: dictionaryTypeKeys.every(typeKey =>
          (manifest.dictionaryContributions ?? []).find(
            item => item.typeKey === typeKey,
          )?.retainOnUninstall === true
        ),
        retainedDictionaryTypeKeys: dictionaryTypeKeys,
        purgeEndpoint: null,
      },
    },
  }
}

function validateLifecycle(metadata, manifest) {
  const uninstall = metadata.lifecycle?.uninstall
  if (
    metadata.kind !== 'pah-business-module' ||
    metadata.activationMode !== 'restart' ||
    metadata.lifecycle?.manager !== 'pah' ||
    metadata.lifecycle?.installMode !== 'controlled-build-restart' ||
    metadata.installerCompatibility?.pahBusinessModule !== true ||
    metadata.installerCompatibility?.coolNativeHook !== false ||
    metadata.lifecycle?.requiresTrustedBackup !== true ||
    uninstall?.retainBusinessData !== true ||
    uninstall?.retainDictionary !== true ||
    uninstall?.purgeEndpoint !== null ||
    manifest.uninstall?.retainDataByDefault !== true ||
    manifest.dataOwnership?.retainedOnUninstall !== true
  ) {
    throw new Error('生产包必须由 Pah 受控安装，卸载默认保留业务数据和字典')
  }
}

function parseVersion(value) {
  const match = String(value).trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/)
  if (!match) throw new Error(`不支持的语义化版本：${value}`)
  return match.slice(1).map(part => Number(part ?? 0))
}

function compareVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

function rangeFromSpecifier(rawSpecifier) {
  let specifier = String(rawSpecifier).trim()
  if (specifier.startsWith('npm:')) {
    const versionSeparator = specifier.lastIndexOf('@')
    if (versionSeparator <= 4) {
      throw new Error(`不支持的 npm alias 版本：${rawSpecifier}`)
    }
    specifier = specifier.slice(versionSeparator + 1)
  }
  if (/^\d+(?:\.\d+){0,2}$/.test(specifier)) {
    const exact = parseVersion(specifier)
    return { min: exact, minInclusive: true, max: exact, maxInclusive: true }
  }
  if (specifier.startsWith('^') || specifier.startsWith('~')) {
    const operator = specifier[0]
    const min = parseVersion(specifier.slice(1))
    const max = [...min]
    if (operator === '~') {
      max[1] += 1
      max[2] = 0
    } else if (min[0] > 0) {
      max[0] += 1
      max[1] = 0
      max[2] = 0
    } else if (min[1] > 0) {
      max[1] += 1
      max[2] = 0
    } else {
      max[2] += 1
    }
    return { min, minInclusive: true, max, maxInclusive: false }
  }
  const clauses = specifier.split(/\s+/).filter(Boolean)
  const result = { min: [0, 0, 0], minInclusive: true, max: null, maxInclusive: false }
  for (const clause of clauses) {
    const match = clause.match(/^(>=|>|<=|<)(\d+(?:\.\d+){0,2})$/)
    if (!match) throw new Error(`不支持的语义化版本范围：${rawSpecifier}`)
    const version = parseVersion(match[2])
    if (match[1] === '>=' || match[1] === '>') {
      result.min = version
      result.minInclusive = match[1] === '>='
    } else {
      result.max = version
      result.maxInclusive = match[1] === '<='
    }
  }
  return result
}

function rangesIntersect(left, right) {
  const lowerOrder = compareVersion(left.min, right.min)
  const min = lowerOrder >= 0 ? left.min : right.min
  const minInclusive = lowerOrder > 0
    ? left.minInclusive
    : lowerOrder < 0
      ? right.minInclusive
      : left.minInclusive && right.minInclusive
  let max = null
  let maxInclusive = false
  if (left.max && right.max) {
    const upperOrder = compareVersion(left.max, right.max)
    max = upperOrder <= 0 ? left.max : right.max
    maxInclusive = upperOrder < 0
      ? left.maxInclusive
      : upperOrder > 0
        ? right.maxInclusive
        : left.maxInclusive && right.maxInclusive
  } else if (left.max) {
    max = left.max
    maxInclusive = left.maxInclusive
  } else if (right.max) {
    max = right.max
    maxInclusive = right.maxInclusive
  }
  if (!max) return true
  const order = compareVersion(min, max)
  return order < 0 || (order === 0 && minInclusive && maxInclusive)
}

function validateHostPeerDependencies(metadata, nodeHost, vueHost) {
  const hostPackages = [
    ['node', readJson(path.join(nodeHost, 'package.json'))],
    ['vue', readJson(path.join(vueHost, 'package.json'))],
  ]
  const resolved = {}
  for (const [dependency, requiredRange] of Object.entries(
    metadata.hostCompatibility?.peerDependencies ?? {},
  )) {
    const match = hostPackages
      .map(([runtime, packageJson]) => [
        runtime,
        packageJson.dependencies?.[dependency] ??
          packageJson.devDependencies?.[dependency] ??
          packageJson.optionalDependencies?.[dependency],
      ])
      .find(([, specifier]) => specifier)
    if (!match) {
      throw new Error(`Host 缺少插件 peerDependency：${dependency}@${requiredRange}`)
    }
    const [runtime, specifier] = match
    if (
      !rangesIntersect(
        rangeFromSpecifier(specifier),
        rangeFromSpecifier(requiredRange),
      )
    ) {
      throw new Error(
        `Host 依赖不兼容：${dependency}=${specifier}，插件要求 ${requiredRange}`,
      )
    }
    resolved[dependency] = { runtime, hostSpecifier: specifier, requiredRange }
  }
  return resolved
}

function extractArchive(archivePath) {
  const absoluteArchive = path.resolve(archivePath)
  if (!absoluteArchive.endsWith(phoenixPackageExtension)) {
    throw new Error(`Phoenix 业务插件包必须使用 ${phoenixPackageExtension} 后缀：${absoluteArchive}`)
  }
  if (!existsSync(absoluteArchive) || !lstatSync(absoluteArchive).isFile()) {
    throw new Error(`生产包不存在：${absoluteArchive}`)
  }
  const listed = run('unzip', ['-Z1', absoluteArchive])
    .split(/\r?\n/)
    .filter(Boolean)
  const unique = new Set()
  for (const entry of listed) {
    safeRelativePath(entry, '压缩包条目')
    if (entry.endsWith('/')) throw new Error(`压缩包不得包含目录条目：${entry}`)
    if (unique.has(entry)) throw new Error(`压缩包存在重复条目：${entry}`)
    unique.add(entry)
  }
  const extractedRoot = mkdtempSync(path.join(tmpdir(), 'open-issue-cool-verify-'))
  try {
    run('unzip', ['-qq', absoluteArchive, '-d', extractedRoot])
  } catch (error) {
    rmSync(extractedRoot, { recursive: true, force: true })
    throw error
  }
  return { absoluteArchive, extractedRoot, listed: [...unique].sort() }
}

export function verifyProductionPackage(
  archivePath,
  { keepExtracted = false, allowDirty = false } = {},
) {
  const extracted = extractArchive(archivePath)
  try {
    const files = walkFiles(extracted.extractedRoot)
    if (JSON.stringify(files) !== JSON.stringify(extracted.listed)) {
      throw new Error('压缩包清单与解包文件集合不一致')
    }
    for (const file of files) {
      if (forbiddenPackagePath.test(file)) {
        throw new Error(`生产包包含测试、工具或依赖目录：${file}`)
      }
    }
    for (const executableHookEntry of ['src/index.js', 'source/index.ts']) {
      if (files.includes(executableHookEntry)) {
        throw new Error(`Pah 业务模块包不得包含 COOL 原生 Hook 入口：${executableHookEntry}`)
      }
    }

    const metadata = readJson(path.join(extracted.extractedRoot, 'plugin.json'))
    const manifest = readJson(path.join(extracted.extractedRoot, 'manifest.json'))
    const integrity = readJson(path.join(extracted.extractedRoot, 'integrity.json'))
    const sourcePackage = readJson(
      path.join(extracted.extractedRoot, 'metadata/source-package.json'),
    )
    if (metadata.moduleId !== manifest.moduleId || metadata.version !== manifest.version) {
      throw new Error('plugin.json 与 manifest 版本身份不一致')
    }
    if (
      sourcePackage.name !== '@open-issue/admin-plugin' ||
      sourcePackage.version !== manifest.version ||
      JSON.stringify(metadata.hostCompatibility?.peerDependencies ?? {}) !==
        JSON.stringify(sourcePackage.peerDependencies ?? {})
    ) {
      throw new Error('源码包版本、名称或 Host peerDependencies 与生产包声明不一致')
    }
    if (
      typeof metadata.source?.repository !== 'string' ||
      !metadata.source.repository ||
      metadata.source.repository !== sourcePackage.repository?.url ||
      !/^[a-f0-9]{40}$/.test(metadata.source?.commit ?? '') ||
      typeof metadata.source?.dirty !== 'boolean'
    ) {
      throw new Error('生产包必须声明可追溯的源码仓库、精确提交和 dirty 状态')
    }
    if (metadata.source.dirty && !allowDirty) {
      throw new Error('生产包来自 dirty 工作树，独立验包默认拒绝')
    }
    validateLifecycle(metadata, manifest)

    const expectedIntegrityFiles = files.filter(file => file !== 'integrity.json')
    if (
      integrity.formatVersion !== 1 ||
      integrity.algorithm !== 'sha256' ||
      !Array.isArray(integrity.files) ||
      integrity.files.length !== expectedIntegrityFiles.length
    ) {
      throw new Error('integrity.json 格式或文件数量无效')
    }
    const declared = new Map()
    for (const item of integrity.files) {
      if (
        !item ||
        Object.keys(item).sort().join(',') !== 'path,sha256,size' ||
        !/^[a-f0-9]{64}$/.test(item.sha256) ||
        !Number.isSafeInteger(item.size) ||
        item.size < 0
      ) {
        throw new Error(`非法 integrity 条目：${JSON.stringify(item)}`)
      }
      const relative = safeRelativePath(item.path, 'integrity 路径')
      if (declared.has(relative)) throw new Error(`重复 integrity 路径：${relative}`)
      declared.set(relative, item)
    }
    for (const relative of expectedIntegrityFiles) {
      const item = declared.get(relative)
      const content = readFileSync(path.join(extracted.extractedRoot, relative))
      if (!item || item.size !== content.length || item.sha256 !== sha256(content)) {
        throw new Error(`生产包文件完整性不匹配：${relative}`)
      }
    }

    const nodeRoot = path.join(
      extracted.extractedRoot,
      'payload/node',
      manifest.moduleId,
    )
    const vueRoot = path.join(
      extracted.extractedRoot,
      'payload/vue',
      manifest.moduleId,
    )
    const descriptor = readJson(path.join(nodeRoot, 'pah-plugin.artifacts.json'))
    if (
      descriptor.formatVersion !== 1 ||
      descriptor.moduleId !== manifest.moduleId ||
      descriptor.version !== manifest.version
    ) {
      throw new Error('Node Pah descriptor 与 manifest 不一致')
    }
    if (!existsSync(path.join(nodeRoot, 'config.ts')) || !existsSync(path.join(vueRoot, 'config.ts'))) {
      throw new Error('生产包缺少 Node 或 Vue 业务模块入口')
    }
    for (const migration of manifest.migrations ?? []) {
      const relative = safeRelativePath(migration.artifact?.path, 'migration 路径')
      const sql = readFileSync(path.join(nodeRoot, relative))
      if (`sha256:${sha256(sql)}` !== migration.checksum) {
        throw new Error(`migration checksum 不匹配：${relative}`)
      }
    }

    const report = {
      archivePath: extracted.absoluteArchive,
      moduleId: manifest.moduleId,
      version: manifest.version,
      sourceCommit: metadata.source.commit,
      dirty: metadata.source.dirty,
      fileCount: files.length,
      archiveSize: statSync(extracted.absoluteArchive).size,
      archiveSha256: sha256(readFileSync(extracted.absoluteArchive)),
      migrationCount: (manifest.migrations ?? []).length,
      retainedTableCount: metadata.lifecycle.uninstall.retainedTables.length,
      retainedDictionaryCount:
        metadata.lifecycle.uninstall.retainedDictionaryTypeKeys.length,
      extractedRoot: keepExtracted ? extracted.extractedRoot : undefined,
    }
    if (keepExtracted) return report
    return report
  } finally {
    if (!keepExtracted) {
      rmSync(extracted.extractedRoot, { recursive: true, force: true })
    }
  }
}

export function buildProductionPackage({
  output,
  allowDirty = false,
  beforePublish,
} = {}) {
  run(process.execPath, ['scripts/verify-admin-plugin-manifest.mjs'], { cwd: repoRoot })
  run(process.execPath, ['scripts/verify-admin-plugin-browser-runtime.mjs'], {
    cwd: repoRoot,
  })
  run(process.execPath, ['scripts/verify-admin-plugin-pack.mjs'], { cwd: repoRoot })

  const manifest = readJson(path.join(pluginRoot, 'manifest.json'))
  const packageJson = readJson(path.join(pluginRoot, 'package.json'))
  if (
    packageJson.name !== '@open-issue/admin-plugin' ||
    packageJson.version !== manifest.version
  ) {
    throw new Error('插件 package.json 名称或版本必须与 manifest 一致')
  }
  const sourceCommit = gitValue(['rev-parse', 'HEAD'])
  const dirty = Boolean(gitValue(['status', '--porcelain', '--untracked-files=all']))
  if (dirty && !allowDirty) {
    throw new Error('生产打包要求产品工作树干净；开发检查可显式使用 --allow-dirty')
  }
  const metadata = productionMetadata(manifest, packageJson, sourceCommit, dirty)
  validateLifecycle(metadata, manifest)

  const stageRoot = mkdtempSync(path.join(tmpdir(), 'open-issue-cool-stage-'))
  const outputPath = path.resolve(
    output ??
      path.join(
        repoRoot,
        'dist/admin-plugin',
        `${manifest.moduleId}-${manifest.version}${phoenixPackageExtension}`,
      ),
  )
  const outputDirectory = path.dirname(outputPath)
  mkdirSync(outputDirectory, { recursive: true })
  const publishRoot = mkdtempSync(path.join(outputDirectory, '.cool-pack-'))
  const temporaryArchive = path.join(publishRoot, `package${phoenixPackageExtension}`)

  try {
    writeJson(path.join(stageRoot, 'plugin.json'), metadata)
    copyNormalized(path.join(pluginRoot, 'manifest.json'), path.join(stageRoot, 'manifest.json'))
    copyNormalized(path.join(pluginRoot, 'README.md'), path.join(stageRoot, 'README.md'))
    copyNormalized(
      path.join(pluginRoot, 'package.json'),
      path.join(stageRoot, 'metadata/source-package.json'),
    )

    for (const relative of npmPackFiles()) {
      let target
      if (relative.startsWith(`midway/${manifest.moduleId}/`)) {
        target = `payload/node/${relative.slice('midway/'.length)}`
      } else if (relative.startsWith(`vue/${manifest.moduleId}/`)) {
        target = `payload/vue/${relative.slice('vue/'.length)}`
      } else {
        continue
      }
      copyNormalized(path.join(pluginRoot, relative), path.join(stageRoot, target))
    }

    const payloadFiles = walkFiles(stageRoot)
    const integrity = {
      formatVersion: 1,
      algorithm: 'sha256',
      files: payloadFiles.map(relative => {
        const content = readFileSync(path.join(stageRoot, relative))
        return { path: relative, size: content.length, sha256: sha256(content) }
      }),
    }
    writeJson(path.join(stageRoot, 'integrity.json'), integrity)
    const allFiles = walkFiles(stageRoot)
    run('zip', ['-X', '-q', '-D', temporaryArchive, '-@'], {
      cwd: stageRoot,
      input: `${allFiles.join('\n')}\n`,
    })

    // 先验证临时包，再以同文件系统 hard link 原子发布；任何校验失败都不会留下目标包。
    verifyProductionPackage(temporaryArchive, { allowDirty })
    beforePublish?.({ outputPath, temporaryArchive })

    try {
      linkSync(temporaryArchive, outputPath)
    } catch (error) {
      if (error?.code === 'EEXIST') {
        throw new Error(`生产包已存在，默认不覆盖：${outputPath}`)
      }
      throw error
    }
    return verifyProductionPackage(outputPath, { allowDirty })
  } finally {
    rmSync(stageRoot, { recursive: true, force: true })
    rmSync(publishRoot, { recursive: true, force: true })
  }
}

function exportHostSnapshot(hostRoot, outputRoot, label) {
  if (gitValue(['status', '--porcelain', '--untracked-files=all'], hostRoot)) {
    throw new Error(`${label} Host 基线必须干净：${hostRoot}`)
  }
  const commit = gitValue(['rev-parse', 'HEAD'], hostRoot)
  const tarRoot = mkdtempSync(path.join(tmpdir(), 'open-issue-host-archive-'))
  const tarPath = path.join(tarRoot, `${label}.tar`)
  mkdirSync(outputRoot, { recursive: true })
  try {
    run('git', ['archive', '--format=tar', '-o', tarPath, 'HEAD'], { cwd: hostRoot })
    run('tar', ['-xf', tarPath, '-C', outputRoot])
  } finally {
    rmSync(tarRoot, { recursive: true, force: true })
  }
  return commit
}

export function assembleCleanHost({ archive, nodeHost, vueHost, output }) {
  const report = verifyProductionPackage(archive, { keepExtracted: true })
  const extractedRoot = report.extractedRoot
  const outputRoot = path.resolve(output)
  let createdOutput = false
  try {
    const absoluteNodeHost = path.resolve(nodeHost)
    const absoluteVueHost = path.resolve(vueHost)
    const metadata = readJson(path.join(extractedRoot, 'plugin.json'))
    const hostCompatibility = validateHostPeerDependencies(
      metadata,
      absoluteNodeHost,
      absoluteVueHost,
    )
    if (existsSync(outputRoot)) throw new Error(`装配输出已存在：${outputRoot}`)
    mkdirSync(path.dirname(outputRoot), { recursive: true })
    mkdirSync(outputRoot)
    createdOutput = true

    const nodeOutput = path.join(outputRoot, 'node')
    const vueOutput = path.join(outputRoot, 'vue')
    const nodeCommit = exportHostSnapshot(absoluteNodeHost, nodeOutput, 'node')
    const vueCommit = exportHostSnapshot(absoluteVueHost, vueOutput, 'vue')

    for (const payload of metadata.payloads) {
      const hostOutput = payload.runtime === 'node' ? nodeOutput : vueOutput
      const source = path.join(extractedRoot, safeRelativePath(payload.source))
      const target = path.join(hostOutput, safeRelativePath(payload.target))
      if (!existsSync(source)) throw new Error(`装配 payload 不存在：${payload.source}`)
      if (existsSync(target)) throw new Error(`Host 已存在同名模块，拒绝覆盖：${target}`)
      cpSync(source, target, {
        recursive: true,
        dereference: false,
        errorOnExist: true,
        force: false,
      })
    }

    const evidence = {
      formatVersion: 1,
      moduleId: report.moduleId,
      version: report.version,
      package: {
        path: report.archivePath,
        sha256: report.archiveSha256,
        fileCount: report.fileCount,
      },
      host: { nodeCommit, vueCommit },
      hostCompatibility,
      lifecycle: metadata.lifecycle,
      sourceCommit: report.sourceCommit,
      assembledAt: new Date().toISOString(),
    }
    writeFileSync(
      path.join(outputRoot, 'assembly-evidence.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      { flag: 'wx' },
    )
    return { outputRoot, nodeOutput, vueOutput, evidence }
  } catch (error) {
    if (createdOutput) rmSync(outputRoot, { recursive: true, force: true })
    throw error
  } finally {
    rmSync(extractedRoot, { recursive: true, force: true })
  }
}
