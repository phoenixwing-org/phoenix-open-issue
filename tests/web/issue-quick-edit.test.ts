import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

describe('Issue 快速编辑弹窗', () => {
  it('重要度、紧急度与状态使用直接点选且可自动换行的选项组', () => {
    const dialog = read('packages/web/src/components/IssueQuickEditDialog.vue')
    const dimensions = read('packages/core/src/types/dict.ts')

    expect(dialog).toContain("if (props.field === 'severity')")
    expect(dialog).toContain("if (props.field === 'priority')")
    expect(dialog).toContain("dict.getOptions('priority')")
    expect(dialog).toContain("if (props.field === 'status') return statusOptions")
    expect(dialog).toContain('class="quick-choice-list"')
    expect(dialog).toContain('role="radiogroup"')
    expect(dialog).toContain('role="radio"')
    expect(dialog).toContain(':aria-checked="selected === option.value"')
    expect(dialog).toContain('flex-wrap: wrap')
    expect(dialog).toContain("severity: '重要度'")
    expect(dialog).toContain("priority: '紧急度'")
    expect(dialog).toContain('class="dimension-scale-hint"')
    expect(dialog).toContain('linear-gradient(90deg')
    expect(dimensions.indexOf("{ value: 'trivial', label: '较低' }")).toBeLessThan(
      dimensions.indexOf("{ value: 'fatal', label: '关键' }"),
    )
    expect(dimensions.indexOf("{ value: 'low', label: '可延后' }")).toBeLessThan(
      dimensions.indexOf("{ value: 'critical', label: '立即' }"),
    )
    expect(dialog).not.toContain('placeholder="选择状态"')
  })

  it('状态名称区分待验收、已完成和已取消，并将终态单独分组', () => {
    const dialog = read('packages/web/src/components/IssueQuickEditDialog.vue')

    expect(dialog).toContain("{ value: 'resolved', label: '待验收' }")
    expect(dialog).toContain("{ value: 'closed', label: '已完成' }")
    expect(dialog).toContain("{ value: 'cancelled', label: '已取消' }")
    expect(dialog).toContain('class="quick-choice-divider"')
    expect(dialog).toContain('待验收：处理完成，等待确认；已完成：验收通过；已取消：无需继续处理。')
  })
})
