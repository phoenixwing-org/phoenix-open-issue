#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  buildProductionPackage,
  repoRoot,
  verifyProductionPackage,
} from './lib/admin-plugin-cool-package.mjs'

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

const temporaryRoot = mkdtempSync(
  path.join(tmpdir(), 'open-issue-production-package-gate-'),
)
const archive = path.join(temporaryRoot, 'phoenix-open-issue.phoenix.cool')
const deterministicArchive = path.join(
  temporaryRoot,
  'phoenix-open-issue-deterministic.phoenix.cool',
)
const raceArchive = path.join(temporaryRoot, 'phoenix-open-issue-race.phoenix.cool')

try {
  const releaseSource = readFileSync(
    path.join(repoRoot, 'scripts/release-admin-plugin-production-package.mjs'),
    'utf8',
  )
  const runtimeBuildIndex = releaseSource.indexOf(
    "runNode('scripts/build-admin-plugin-browser-runtime.mjs')",
  )
  const fullVerifyIndex = releaseSource.indexOf("runPnpm('admin-plugin:verify')")
  const finalPackageIndex = releaseSource.indexOf(
    'const report = buildProductionPackage({ output })',
  )
  if (
    runtimeBuildIndex < 0 ||
    fullVerifyIndex <= runtimeBuildIndex ||
    finalPackageIndex <= fullVerifyIndex
  ) {
    throw new Error(
      'release-package 必须固定执行 runtime build → 完整 admin-plugin:verify → 最终不可变包',
    )
  }

  const built = buildProductionPackage({ output: archive, allowDirty: true })
  const verified = verifyProductionPackage(archive, { allowDirty: true })
  const legacyArchive = path.join(temporaryRoot, 'phoenix-open-issue.pah.cool')
  writeFileSync(legacyArchive, readFileSync(archive), { flag: 'wx' })
  let rejectedLegacySuffix = false
  try {
    verifyProductionPackage(legacyArchive, { allowDirty: true })
  } catch (error) {
    rejectedLegacySuffix = /必须使用 \.phoenix\.cool 后缀/.test(
      String(error?.message ?? error),
    )
  }
  if (!rejectedLegacySuffix) {
    throw new Error('Phoenix 安装器必须拒绝旧 .pah.cool 后缀')
  }
  if (verified.dirty) {
    let rejectedDirty = false
    try {
      verifyProductionPackage(archive)
    } catch (error) {
      rejectedDirty = /dirty 工作树/.test(String(error?.message ?? error))
    }
    if (!rejectedDirty) {
      throw new Error('独立验包必须默认拒绝 dirty 制品')
    }
  }
  if (
    built.archiveSha256 !== verified.archiveSha256 ||
    built.moduleId !== 'phoenix-open-issue' ||
    typeof built.dirty !== 'boolean'
  ) {
    throw new Error('门禁生成包的身份、dirty 标记或 SHA-256 不一致')
  }

  const deterministic = buildProductionPackage({
    output: deterministicArchive,
    allowDirty: true,
  })
  if (deterministic.archiveSha256 !== verified.archiveSha256) {
    throw new Error('相同输入的两次业务模块打包必须得到相同 SHA-256')
  }

  const before = sha256(archive)
  let rejectedOverwrite = false
  try {
    buildProductionPackage({ output: archive, allowDirty: true })
  } catch (error) {
    rejectedOverwrite = /默认不覆盖/.test(String(error?.message ?? error))
  }
  if (!rejectedOverwrite || sha256(archive) !== before) {
    throw new Error('同名生产包必须拒绝覆盖，且原包字节不得变化')
  }

  const sentinel = Buffer.from('concurrent-publisher-owned-target\n', 'utf8')
  let rejectedRace = false
  try {
    buildProductionPackage({
      output: raceArchive,
      allowDirty: true,
      beforePublish: ({ outputPath }) => {
        writeFileSync(outputPath, sentinel, { flag: 'wx' })
      },
    })
  } catch (error) {
    rejectedRace = /默认不覆盖/.test(String(error?.message ?? error))
  }
  if (
    !rejectedRace ||
    !readFileSync(raceArchive).equals(sentinel) ||
    readdirSync(temporaryRoot).some(name => name.startsWith('.cool-pack-'))
  ) {
    throw new Error('并发占用目标时必须 fail-closed，保留竞争方字节并清理临时目录')
  }

  console.log(
    `生产打包门禁通过：${verified.fileCount} 文件；` +
      `${verified.migrationCount} 条 migration；` +
      `卸载保留 ${verified.retainedTableCount} 张表 / ` +
      `${verified.retainedDictionaryCount} 类字典；旧后缀拒绝、确定性打包、同名与并发占用拒绝覆盖。`,
  )
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
