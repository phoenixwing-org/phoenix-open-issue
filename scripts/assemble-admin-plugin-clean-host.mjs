#!/usr/bin/env node

import { assembleCleanHost } from './lib/admin-plugin-cool-package.mjs'

function required(name) {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value) throw new Error(`${name} 缺少路径`)
  return value
}

const result = assembleCleanHost({
  archive: required('--archive'),
  nodeHost: required('--node-host'),
  vueHost: required('--vue-host'),
  output: required('--output'),
})

console.log(
  `干净 Admin 装配完成：${result.outputRoot}\n` +
  `Node ${result.evidence.host.nodeCommit}\n` +
  `Vue ${result.evidence.host.vueCommit}\n` +
  `包 SHA-256 ${result.evidence.package.sha256}`,
)
