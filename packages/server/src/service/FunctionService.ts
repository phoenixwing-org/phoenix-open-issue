import { getAsyncDb } from '../db/connection.js'
import { generateId } from '@open-issue/core'
import { diffImportRows } from '@open-issue/core'
import type { PoiFunction, CreatePoiFunctionInput, UpdatePoiFunctionInput } from '@open-issue/core'

export class FunctionService {
  async list(opts?: { search?: string; platform?: string; sort?: string; numericSort?: boolean }): Promise<PoiFunction[]> {
    const db = getAsyncDb()
    const conditions: string[] = ['enabled = 1']
    const params: unknown[] = []

    if (opts?.search) {
      conditions.push('(functionName LIKE ? OR platform LIKE ?)')
      params.push(`%${opts.search}%`, `%${opts.search}%`)
    }
    if (opts?.platform) {
      conditions.push('platform = ?')
      params.push(opts.platform)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // 排序：默认 platform, externalId；支持按字段排序
    let orderBy = 'platform, externalId'
    if (opts?.sort) {
      const parts = opts.sort.split(':')
      const field = parts[0]
      const dir = parts[1] === 'asc' ? 'ASC' : 'DESC'
      const allowed = new Set(['platform', 'externalId', 'functionName', 'targetYear', 'createdAt'])
      if (allowed.has(field)) {
        // externalId：数字排序时用 CAST，否则字符串排序
        if (field === 'externalId' && opts.numericSort) {
          orderBy = `CAST(externalId AS INTEGER) ${dir}`
        } else {
          orderBy = `${field} ${dir}`
        }
      }
    }

    return await db.all(
      `SELECT * FROM poiFunctions ${where} ORDER BY ${orderBy}`,
      params,
    ) as PoiFunction[]
  }

  async getById(id: string): Promise<PoiFunction | undefined> {
    const db = getAsyncDb()
    return await db.get('SELECT * FROM poiFunctions WHERE id = ?', [id]) as PoiFunction | undefined
  }

  async create(input: CreatePoiFunctionInput): Promise<PoiFunction> {
    const db = getAsyncDb()
    const id = generateId()
    try {
      await db.run(
        `INSERT INTO poiFunctions (id, platform, externalId, functionName, targetYear, clientGroup, developGroup)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, input.platform, input.externalId, input.functionName,
         input.targetYear ?? null, input.clientGroup ?? null, input.developGroup ?? null],
      )
    } catch (e: any) {
      if (e?.message?.includes('UNIQUE')) {
        const existing = await db.get(
          'SELECT id, enabled FROM poiFunctions WHERE platform = ? AND externalId = ?',
          [input.platform, input.externalId],
        ) as { id: string; enabled: number } | undefined
        if (existing?.enabled === 0) {
          await db.run(
            `UPDATE poiFunctions SET functionName = ?, targetYear = ?, clientGroup = ?,
             developGroup = ?, enabled = 1, updatedAt = ? WHERE id = ?`,
            [input.functionName, input.targetYear ?? null, input.clientGroup ?? null,
             input.developGroup ?? null, new Date().toISOString(), existing.id],
          )
          return await this.getById(existing.id) as PoiFunction
        }
        throw Object.assign(
          new Error(`功能已存在：平台 "${input.platform}" 下的 ID "${input.externalId}"`),
          { statusCode: 409 },
        )
      }
      throw e
    }
    return await db.get('SELECT * FROM poiFunctions WHERE id = ?', [id]) as PoiFunction
  }

  async update(id: string, input: UpdatePoiFunctionInput): Promise<PoiFunction> {
    const db = getAsyncDb()
    await db.run(
      `UPDATE poiFunctions SET
        platform = COALESCE(?, platform),
        externalId = COALESCE(?, externalId),
        functionName = COALESCE(?, functionName),
        targetYear = COALESCE(?, targetYear),
        clientGroup = COALESCE(?, clientGroup),
        developGroup = COALESCE(?, developGroup),
        updatedAt = ?
       WHERE id = ?`,
      [input.platform ?? null, input.externalId ?? null, input.functionName ?? null,
       input.targetYear ?? null, input.clientGroup ?? null, input.developGroup ?? null,
       new Date().toISOString(), id],
    )
    return await db.get('SELECT * FROM poiFunctions WHERE id = ?', [id]) as PoiFunction
  }

  async delete(id: string): Promise<void> {
    const db = getAsyncDb()
    await db.run('UPDATE poiFunctions SET enabled = 0, updatedAt = ? WHERE id = ?', [new Date().toISOString(), id])
  }

  /**
   * 批量导入功能条目。同一 (platform, externalId) 已存在则更新，否则新增。
   * 使用核心包中的纯函数 diffImportRows() 进行分类。
   */
  async importBatch(rows: CreatePoiFunctionInput[]): Promise<{ imported: number; updated: number }> {
    const db = getAsyncDb()

    // 查询已有记录，用于 diffImportRows
    const existing = await db.all(
      'SELECT id, platform, externalId FROM poiFunctions',
    ) as { id: string; platform: string; externalId: string }[]

    const { toInsert, toUpdate } = diffImportRows(existing, rows)

    let imported = 0
    let updated = 0

    await db.transaction(async tx => {
      for (const row of toInsert) {
        await tx.run(
          `INSERT INTO poiFunctions (id, platform, externalId, functionName, targetYear, clientGroup, developGroup)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [generateId(), row.platform, row.externalId, row.functionName,
           row.targetYear ?? null, row.clientGroup ?? null, row.developGroup ?? null],
        )
        imported++
      }
      for (const { id, data } of toUpdate) {
        await tx.run(
          `UPDATE poiFunctions SET
            functionName = ?, targetYear = ?, clientGroup = ?, developGroup = ?, enabled = 1, updatedAt = ?
           WHERE id = ?`,
          [data.functionName, data.targetYear ?? null, data.clientGroup ?? null, data.developGroup ?? null,
           new Date().toISOString(), id],
        )
        updated++
      }
    })
    return { imported, updated }
  }

  async exportAll(): Promise<PoiFunction[]> {
    const db = getAsyncDb()
    return await db.all('SELECT * FROM poiFunctions ORDER BY platform, externalId') as PoiFunction[]
  }
}
