#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { buildProductionPackage, repoRoot } from './lib/admin-plugin-cool-package.mjs'

const args = process.argv.slice(2).filter(value => value !== '--')
const outputIndex = args.indexOf('--output')
const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined
if (outputIndex >= 0 && !output) throw new Error('--output 缺少路径')

function runNode(script) {
  execFileSync(process.execPath, [script], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

function runPnpm(script) {
  execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [script], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

// 发布顺序是硬契约：先重建 runtime/descriptor，再执行完整工程与制品门禁，
// 最后才生成不可变包。不能依赖发布前曾经手工运行过 typecheck/test。
runNode('scripts/build-admin-plugin-browser-runtime.mjs')
runPnpm('admin-plugin:verify')
const report = buildProductionPackage({ output })

console.log(
  `Open Issue Phoenix 业务插件发布包已生成：${report.archivePath}\n` +
    `SHA-256 ${report.archiveSha256}；${report.fileCount} 文件；` +
    `dirty=${report.dirty}；COOL 原生 Hook 安装器不兼容（fail-closed）。`,
)
