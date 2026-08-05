import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

describe('Issue 关联点检表计数', () => {
  it('列表直接读取固化 listCount，并在标题单元格右下角仅显示两个以上的关联', () => {
    const list = read('packages/web/src/views/lists/ListDetailView.vue')
    const service = read('packages/server/src/service/IssueService.ts')

    expect(list).toContain('Number(row.listCount) >= 2')
    expect(list).toContain('关联 {{ row.listCount }}')
    expect(list).toContain('v-if="canPushRow(row)"')
    expect(service).toContain("_canPush: canPerformListAction(user, currentRole, 'push')")
    expect(service).not.toContain("_canPush: item.listId === listId")
    expect(list).toContain('class="issue-title-cell"')
    expect(list).toContain('class="issue-list-count"')
    expect(list).toMatch(/\.issue-title-cell\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*align-items:\s*end/)
    expect(list).toMatch(/\.issue-list-count\s*\{[\s\S]*align-self:\s*end/)
  })

  it('Issue 详情与 Primary 同步显示两个以上的关联点检表数量', () => {
    const detail = read('packages/web/src/views/issues/IssueDetailView.vue')
    const primary = read('packages/web/src/components/workbench/PoiIssueDetailPrimary.vue')

    expect(detail).toContain('issueStore.currentIssue.listCount >= 2')
    expect(detail).toContain('关联点检表 {{ issueStore.currentIssue.listCount }}')
    expect(detail).toContain('listCount: issue?.listCount ?? 0')
    expect(primary).toContain('listCount: number')
    expect(primary).toContain('v-if="listCount >= 2"')
  })
})
