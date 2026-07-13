import { describe, expect, it } from 'vitest'
import { pnwCompilePostgresParams } from '../../packages/server/src/db/pnw/pnwSqlParams.js'

describe('pnwCompilePostgresParams', () => {
  it('按顺序转换普通占位符', () => {
    expect(pnwCompilePostgresParams('SELECT * FROM "issues" WHERE "id" = ? AND "status" = ?'))
      .toEqual({
        text: 'SELECT * FROM "issues" WHERE "id" = $1 AND "status" = $2',
        parameterCount: 2,
      })
  })

  it('自动引用项目内 camelCase 表和字段', () => {
    const result = pnwCompilePostgresParams(
      'SELECT i.issueNo AS issueNo FROM issues i WHERE i.listId = ?',
    )
    expect(result.text).toBe(
      'SELECT i."issueNo" AS "issueNo" FROM "issues" i WHERE i."listId" = $1',
    )
  })

  it('不会改写字符串、注释或相似标识符', () => {
    const result = pnwCompilePostgresParams(
      "SELECT 'issueNo' AS textValue, customIssueNo FROM issues -- listId\nWHERE id = ?",
    )
    expect(result.text).toBe(
      "SELECT 'issueNo' AS textValue, customIssueNo FROM \"issues\" -- listId\nWHERE \"id\" = $1",
    )
  })

  it('不转换单引号和双引号中的问号', () => {
    const result = pnwCompilePostgresParams(`SELECT '?' AS "?", "id" FROM "issues" WHERE "id" = ?`)
    expect(result.text).toBe(`SELECT '?' AS "?", "id" FROM "issues" WHERE "id" = $1`)
    expect(result.parameterCount).toBe(1)
  })

  it('支持 SQL 转义引号', () => {
    const result = pnwCompilePostgresParams(`SELECT 'it''s ?' WHERE "a""?" = ?`)
    expect(result.text).toBe(`SELECT 'it''s ?' WHERE "a""?" = $1`)
  })

  it('不转换行注释和块注释中的问号', () => {
    const sql = 'SELECT ? -- comment ?\nFROM "issues" /* block ? */ WHERE "id" = ?'
    const result = pnwCompilePostgresParams(sql)
    expect(result.text).toBe('SELECT $1 -- comment ?\nFROM "issues" /* block ? */ WHERE "id" = $2')
    expect(result.parameterCount).toBe(2)
  })

  it('不转换 dollar-quoted 字符串中的问号', () => {
    const result = pnwCompilePostgresParams('SELECT $$?$$, $body$?$body$, ?')
    expect(result).toEqual({ text: 'SELECT $$?$$, $body$?$body$, $1', parameterCount: 1 })
  })

  it('未闭合字符串保持原样且不误转换', () => {
    const result = pnwCompilePostgresParams("SELECT 'unterminated ?")
    expect(result).toEqual({ text: "SELECT 'unterminated ?", parameterCount: 0 })
  })
})
