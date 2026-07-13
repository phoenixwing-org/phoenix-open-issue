import type { Request, Response } from 'express'
import { TestService } from '../service/TestService.js'
import { assertSystemAdminAsync } from '../utils/admin.js'
import { getAsyncDb } from '../db/connection.js'

const testService = new TestService()

export class TestController {
  async listFiles(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
    const files = await testService.listFiles()
    res.json({ files, available: testService.isAvailable() })
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
    res.json(testService.getStatus())
  }

  async runAll(req: Request, res: Response): Promise<void> {
    await assertSystemAdminAsync(getAsyncDb(), req.user!.userId)
    const result = await testService.runAll()
    res.json({
      message: result.summary.success ? '全部通过' : '存在失败用例',
      ...result,
    })
  }
}
