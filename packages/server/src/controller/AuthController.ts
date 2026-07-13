import type { Request, Response } from 'express'
import { AuthService } from '../service/AuthService.js'
import { BadRequestError } from '../utils/errors.js'
import { routeParam } from '../utils/request.js'

const authService = new AuthService()

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body)
    res.status(201).json(result)
  }

  async login(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body
    const result = await authService.login(username, password)
    res.json(result)
  }

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getMe(req.user!.userId)
    res.json(user)
  }

  async getAllUsers(req: Request, res: Response): Promise<void> {
    const includeDisabled = req.query.includeDisabled === 'true'
    const users = await authService.getAllUsers(includeDisabled)
    res.json(users)
  }

  async getPendingUsers(req: Request, res: Response): Promise<void> {
    const users = await authService.getPendingUsers(req.user!.userId)
    res.json(users)
  }

  async approveUser(req: Request, res: Response): Promise<void> {
    const { approved } = req.body ?? {}
    if (typeof approved !== 'boolean') {
      throw new BadRequestError('缺少 approved 参数（true 批准 / false 拒绝）')
    }
    const user = await authService.approveUser(routeParam(req, 'userId'), approved, req.user!.userId)
    res.json(user)
  }

  async updateUserOrg(req: Request, res: Response): Promise<void> {
    const user = await authService.updateUserOrg(routeParam(req, 'userId'), req.body.orgUnitId, req.user!.userId)
    res.json(user)
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    const user = await authService.updateUser(routeParam(req, 'userId'), req.body, req.user!.userId)
    res.json(user)
  }

  // ── Feature 1: 用户禁用 ──
  async disableUser(req: Request, res: Response): Promise<void> {
    const user = await authService.disableUser(routeParam(req, 'userId'), req.user!.userId)
    res.json(user)
  }

  async enableUser(req: Request, res: Response): Promise<void> {
    const user = await authService.enableUser(routeParam(req, 'userId'), req.user!.userId)
    res.json(user)
  }

  // ── Feature 4: 密码重置 ──
  async changePassword(req: Request, res: Response): Promise<void> {
    const { oldPassword, newPassword } = req.body
    await authService.changePassword(req.user!.userId, oldPassword, newPassword)
    res.json({ message: '密码已修改' })
  }

  async adminResetPassword(req: Request, res: Response): Promise<void> {
    const { newPassword } = req.body
    await authService.adminResetPassword(routeParam(req, 'userId'), newPassword, req.user!.userId)
    res.json({ message: '密码已重置' })
  }
}
