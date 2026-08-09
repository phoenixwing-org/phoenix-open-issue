import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defaultIssueListColumns,
  upgradeIssueListColumns,
  visibleColumnsForMode,
} from '../../packages/web/src/config/issueListColumns'

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

describe('Issue 与点检时间语义', () => {
  it('跟踪视图默认显示截止日而不是创建日期', () => {
    const settings = defaultIssueListColumns()
    const visible = visibleColumnsForMode('timeline', settings)

    expect(visible).toContain('dueDate')
    expect(visible).not.toContain('createdAt')
    expect(visible.indexOf('dueDate')).toBeLessThan(visible.indexOf('checkpoints'))
  })

  it('把旧的本地跟踪列配置一次性迁移为截止日', () => {
    const legacy = defaultIssueListColumns()
    legacy.timeline.find(item => item.key === 'dueDate')!.visible = false
    legacy.timeline.find(item => item.key === 'createdAt')!.visible = true

    const upgraded = upgradeIssueListColumns(legacy, 1)
    const visible = visibleColumnsForMode('timeline', upgraded)
    expect(visible).toContain('dueDate')
    expect(visible).not.toContain('createdAt')
  })

  it('点检日用于时间线，截止日可选且只负责逾期', () => {
    const compact = read('packages/web/src/components/IssueListCell.vue')
    const detail = read('packages/web/src/components/IssueCheckpointTimeline.vue')
    const form = read('packages/web/src/components/CheckpointFormDialog.vue')

    expect(compact).toContain("'点检日: ' + cp.checkpointDate")
    expect(compact).not.toContain('cp.createdAt')
    expect(compact).toContain('isOverdue(cp.deadline, cp.status)')
    expect(detail).toContain("截止 {{ checkpoint.deadline || '—' }}")
    expect(detail).toContain('点检 {{ checkpoint.checkpointDate }}')
    expect(detail).toContain('label="截止" width="98"')
    expect(detail).toContain("{{ row.deadline || '—' }}")
    expect(detail).toContain('prop="checkpointDate" label="点检日"')
    expect(detail).toContain('class="checkpoint-date-row"')
    expect(detail).toContain(':hide-timestamp="true"')
    expect(detail).toContain('class="checkpoint-owner-name"')
    expect(detail).toContain('grid-template-columns: auto 4em')
    expect(detail).toContain('<strong>点检 · 时间线</strong>')
    expect(detail).not.toContain('createdAt')
    expect(form).toContain('label="点检日" required')
    expect(form).toContain('label="截止（可选）"')
    expect(form).toContain('placeholder="无截止日"')
    expect(form).not.toContain('createdAt')
  })

  it('工作区包版本统一为 0.7.1，Wing 依赖仍精确锁定已发布的 0.6.0', () => {
    const manifests = [
      'package.json',
      'packages/core/package.json',
      'packages/server/package.json',
      'packages/web/package.json',
    ].map(file => JSON.parse(read(file)))

    expect(manifests.map(manifest => manifest.version)).toEqual(Array(4).fill('0.7.1'))
    expect(manifests[2].dependencies['phoenix-wing']).toBe('0.6.0')
    expect(manifests[3].dependencies['phoenix-wing']).toBe('0.6.0')
  })
})
