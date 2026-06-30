import type { Request, Response } from 'express'
import { seedDatabase } from '../seed.js'

export class SeedController {
  run(req: Request, res: Response): void {
    const force = req.query.force === 'true'
    const logs = seedDatabase(force)
    res.json({ ok: true, logs })
  }
}
