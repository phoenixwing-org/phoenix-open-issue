import type { Request, Response } from 'express'
import { seedDatabase, seedTestData, getSystemFlag, setSystemFlag } from '../seed.js'

export class SeedController {
  /** 强制重新播种（清空 + 重建所有数据） */
  run(req: Request, res: Response): void {
    const force = req.query.force === 'true'
    const logs = seedDatabase(force)
    res.json({ ok: true, logs })
  }

  /** 查询测试数据状态 */
  getSeedStatus(_req: Request, res: Response): void {
    const flag = getSystemFlag('seedTestData')
    res.json({
      seeded: flag === 'done',
      declined: flag === 'declined',
      pending: !flag,
    })
  }

  /** 添加测试数据 */
  addTestData(_req: Request, res: Response): void {
    const logs = seedTestData()
    res.json({ ok: true, logs })
  }

  /** 拒绝测试数据（不再询问） */
  declineTestData(_req: Request, res: Response): void {
    setSystemFlag('seedTestData', 'declined')
    res.json({ ok: true })
  }
}
