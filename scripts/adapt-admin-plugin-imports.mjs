import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADMIN_PLUGIN_VUE_ROOT } from './admin-plugin-ui-files.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = path.join(repoRoot, ADMIN_PLUGIN_VUE_ROOT)
const apply = process.argv.includes('--apply')

const replacements = [
  ["'@/views/issues/IssueDetailView.vue", "'/$/phoenix-open-issue/views/issue-detail.vue"],
  ['"@/views/issues/IssueDetailView.vue', '"/$/phoenix-open-issue/views/issue-detail.vue'],
  ["@open-issue/core", "/$/phoenix-open-issue/core"],
  ["'@/", "'/$/phoenix-open-issue/"],
  ['"@/', '"/$/phoenix-open-issue/'],
]

async function visit(directory) {
  for (const entry of await readdir(directory)) {
    const target = path.join(directory, entry)
    if ((await stat(target)).isDirectory()) {
      await visit(target)
      continue
    }
    if (!/\.(ts|vue)$/.test(entry)) continue

    const before = await readFile(target, 'utf8')
    const after = replacements.reduce(
      (content, [from, to]) => content.replaceAll(from, to),
      before,
    )
    if (after === before) continue
    console.log(path.relative(repoRoot, target))
    if (apply) await writeFile(target, after)
  }
}

await visit(pluginRoot)
console.log(apply ? '插件内部 import 已转换。' : 'Dry run：使用 --apply 才会写入。')
