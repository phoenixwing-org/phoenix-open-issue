import type { Request, Response } from 'express'
import { seedDatabase, seedTestData, getSystemFlag, setSystemFlag } from '../seed.js'
import { assertSystemAdminAsync } from '../utils/admin.js'
import { getAsyncDb } from '../db/connection.js'

export class SeedController {
  /** 强制重新播种（清空 + 重建所有数据） */
  async run(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
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
  async addTestData(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
    const logs = await seedTestData()
    res.json({ ok: true, logs })
  }

  /** 拒绝测试数据（不再询问） */
  async declineTestData(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
    await setSystemFlag('seedTestData', 'declined')
    res.json({ ok: true })
  }
}
