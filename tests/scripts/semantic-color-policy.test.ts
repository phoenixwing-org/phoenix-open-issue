import { describe, expect, it } from 'vitest'
import { findRawSemanticColors } from '../../scripts/lib/semantic-color-policy.mjs'

describe('Admin plugin semantic color policy', () => {
  it('accepts Element Plus and Wing tokens with literal fallbacks', () => {
    const source = `<style scoped>
.page { color: var(--el-text-color-primary, #303133); }
.card { background: var(--pnw-workbench-surface, var(--el-bg-color, #fff)); }
.card:hover { box-shadow: var(--el-box-shadow-light, 0 4px 12px rgba(0,0,0,.08)); }
</style>`
    expect(findRawSemanticColors(source)).toEqual([])
  })

  it('rejects raw CSS and inline style colors, including border and gradient values', () => {
    const source = `<template><p style="color:#909399">hint</p></template>
<style>
.card { border: 1px solid #ebeef5; }
.scale { background: linear-gradient(90deg, #67c23a, #f56c6c); }
</style>`
    expect(findRawSemanticColors(source)).toMatchObject([
      { line: 1, property: 'color' },
      { line: 3, property: 'border' },
      { line: 4, property: 'background' },
    ])
  })

  it('rejects standalone script/template color strings', () => {
    const source = `<script setup>const colors = ['#67c23a', 'rgba(0, 0, 0, .2)']</script>`
    expect(findRawSemanticColors(source)).toHaveLength(2)
  })
})
