import type { Request, Response } from 'express'
import { seedDatabase, seedTestData, getSystemFlag, setSystemFlag } from '../seed.js'

export class SeedController {
  /** 强制重新播种（清空 + 重建所有数据） */
  async run(req: Request, res: Response): Promise<void> {
    const force = req.query.force === 'true'
    const logs = await seedDatabase(force)
    res.json({ ok: true, logs })
  }

  /** 查询测试数据状态 */
  async getSeedStatus(_req: Request, res: Response): Promise<void> {
    const flag = await getSystemFlag('seedTestData')
    res.json({
      seeded: flag === 'done',
      declined: flag === 'declined',
      pending: !flag,
    })
  }

  /** 添加测试数据 */
  async addTestData(_req: Request, res: Response): Promise<void> {
    const logs = await seedTestData()
    res.json({ ok: true, logs })
  }

  /** 拒绝测试数据（不再询问） */
  async declineTestData(_req: Request, res: Response): Promise<void> {
    await setSystemFlag('seedTestData', 'declined')
    res.json({ ok: true })
  }
}
