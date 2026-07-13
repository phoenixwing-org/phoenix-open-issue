import type { Request, Response } from 'express'
import { FunctionService } from '../service/FunctionService.js'
import { routeParam } from '../utils/request.js'

const functionService = new FunctionService()

export class FunctionController {
  async list(req: Request, res: Response): Promise<void> {
    const items = await functionService.list({
      search: req.query.search as string | undefined,
      platform: req.query.platform as string | undefined,
      sort: req.query.sort as string | undefined,
      numericSort: req.query.numericSort === '1',
    })
    res.json(items)
  }

  async getById(req: Request, res: Response): Promise<void> {
    const item = await functionService.getById(routeParam(req, 'id'))
    if (!item) {
      res.status(404).json({ error: '功能不存在' })
      return
    }
    res.json(item)
  }

  async create(req: Request, res: Response): Promise<void> {
    const item = await functionService.create(req.body)
    res.status(201).json(item)
  }

  async update(req: Request, res: Response): Promise<void> {
    const item = await functionService.update(routeParam(req, 'id'), req.body)
    res.json(item)
  }

  async delete(req: Request, res: Response): Promise<void> {
    await functionService.delete(routeParam(req, 'id'))
    res.status(204).send()
  }

  async importBatch(req: Request, res: Response): Promise<void> {
    const { rows } = req.body
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows 必须是非空数组' })
      return
    }
    const result = await functionService.importBatch(rows)
    res.json(result)
  }

  async exportAll(_req: Request, res: Response): Promise<void> {
    const data = await functionService.exportAll()
    res.setHeader('Content-Disposition', `attachment; filename="functions-${new Date().toISOString().slice(0, 10)}.json"`)
    res.json(data)
  }
}
