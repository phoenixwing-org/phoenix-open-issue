#!/usr/bin/env node

import path from 'node:path'
import { pluginRoot, verifyProductionPackage } from './lib/admin-plugin-cool-package.mjs'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(path.join(pluginRoot, 'manifest.json'), 'utf8'))
const defaultArchive = path.resolve(
  'dist/admin-plugin',
  `${manifest.moduleId}-${packageJson.version}.phoenix.cool`,
)
const [archive] = process.argv.slice(2).filter(value => value !== '--')
const report = verifyProductionPackage(archive ?? defaultArchive)
console.log(
  `Phoenix 业务插件包合法：${report.moduleId}@${report.version}；` +
  `${report.fileCount} 文件；SHA-256 ${report.archiveSha256}；` +
  `卸载保留 ${report.retainedTableCount} 张表 / ` +
  `${report.retainedDictionaryCount} 类字典。`,
)
