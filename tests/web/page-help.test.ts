import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PAGE_HELP } from '../../packages/web/src/content/pageHelp.js'

function readVueSource(dir: string): string {
  return fs.readdirSync(dir, { withFileTypes: true }).map(entry => {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) return readVueSource(target)
    return entry.isFile() && entry.name.endsWith('.vue') ? fs.readFileSync(target, 'utf8') : ''
  }).join('\n')
}

const vueSource = readVueSource(path.resolve('packages/web/src'))
const tourAnchors = new Set(
  Array.from(vueSource.matchAll(/\bdata-tour=["']([^"']+)["']/g), match => match[1]),
)

describe('页面帮助与巡游锚点', () => {
  it('每个巡游步骤都对应真实页面锚点', () => {
    const missing: string[] = []
    for (const [pageId, content] of Object.entries(PAGE_HELP)) {
      for (const tourStep of content.tourSteps ?? []) {
        if (typeof tourStep.element !== 'string') continue
        const match = tourStep.element.match(/^\[data-tour=['"]([^'"]+)['"]\]$/)
        if (!match || !tourAnchors.has(match[1])) missing.push(`${pageId}: ${tourStep.element}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('页面上的帮助按钮都有对应内容，帮助内容也都有入口', () => {
    const pageIds = new Set(
      Array.from(vueSource.matchAll(/<PageHelpButton\s+page-id=["']([^"']+)["']/g), match => match[1]),
    )
    expect([...pageIds].sort()).toEqual(Object.keys(PAGE_HELP).sort())
  })
})
