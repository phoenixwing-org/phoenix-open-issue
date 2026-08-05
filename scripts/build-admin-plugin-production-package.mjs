#!/usr/bin/env node

import { buildProductionPackage } from './lib/admin-plugin-cool-package.mjs'

const args = process.argv.slice(2)
const allowDirty = args.includes('--allow-dirty')
const outputIndex = args.indexOf('--output')
const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined
if (outputIndex >= 0 && !output) throw new Error('--output 缺少路径')

const report = buildProductionPackage({ output, allowDirty })
console.log(
  `Phoenix 业务插件包已生成：${report.archivePath}\n` +
  `SHA-256 ${report.archiveSha256}；${report.fileCount} 文件；` +
  `${report.migrationCount} 条 migration；卸载保留 ` +
  `${report.retainedTableCount} 张表 / ${report.retainedDictionaryCount} 类字典。`,
)
