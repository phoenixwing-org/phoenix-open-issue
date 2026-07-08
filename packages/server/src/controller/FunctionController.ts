import type { Request, Response } from 'express'
import { FunctionService } from '../service/FunctionService.js'

const functionService = new FunctionService()

export class FunctionController {
  list(req: Request, res: Response): void {
    const items = functionService.list({
      search: req.query.search as string | undefined,
      platform: req.query.platform as string | undefined,
      sort: req.query.sort as string | undefined,
      numericSort: req.query.numericSort === '1',
    })
    res.json(items)
  }

  getById(req: Request, res: Response): void {
    const item = functionService.getById(req.params.id)
    if (!item) {
      res.status(404).json({ error: '功能不存在' })
      return
    }
    res.json(item)
  }

  create(req: Request, res: Response): void {
    const item = functionService.create(req.body)
    res.status(201).json(item)
  }

  update(req: Request, res: Response): void {
    const item = functionService.update(req.params.id, req.body)
    res.json(item)
  }

  delete(req: Request, res: Response): void {
    functionService.delete(req.params.id)
    res.status(204).send()
  }

  importBatch(req: Request, res: Response): void {
    const { rows } = req.body
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows 必须是非空数组' })
      return
    }
    const result = functionService.importBatch(rows)
    res.json(result)
  }

  exportAll(_req: Request, res: Response): void {
    const data = functionService.exportAll()
    res.setHeader('Content-Disposition', `attachment; filename="functions-${new Date().toISOString().slice(0, 10)}.json"`)
    res.json(data)
  }
}
