import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const script = readFileSync(
  new URL('../../../../scripts/mount-admin-plugin-dev.ps1', import.meta.url),
  'utf8',
)
const pluginGuide = readFileSync(
  new URL('../../README.md', import.meta.url),
  'utf8',
)

describe('Windows Admin 插件开发挂载契约', () => {
  it('只使用 Junction 并在创建后校验 LinkType 与目标', () => {
    expect(script).toContain("New-Item -ItemType Junction")
    expect(script).toContain("$Verified.LinkType -ne 'Junction'")
    expect(script).toContain('Test-SamePath $ActualTarget $Mount.Source')
    expect(script).not.toContain('-ItemType SymbolicLink')
  })

  it('同时声明 Vue/Node 挂载且拒绝覆盖真实目录和外来 Junction', () => {
    expect(script).toContain("Label = 'Vue Host'")
    expect(script).toContain("Label = 'Node Host'")
    expect(script).toContain("$State.State -eq 'Occupied'")
    expect(script).toContain("$State.State -eq 'ForeignJunction'")
  })

  it('插件说明使用变量传入 Host 根目录且不含个人 Windows 用户路径', () => {
    expect(pluginGuide).toContain('-VueHostRoot $VueHostRoot')
    expect(pluginGuide).toContain('-NodeHostRoot $NodeHostRoot')
    expect(pluginGuide).toContain('LinkType` 都必须是 `Junction`')
    expect(pluginGuide).not.toMatch(/[A-Z]:\\Users\\[^<\\\s]+/i)
  })
})
