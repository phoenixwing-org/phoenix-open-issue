import type { Request, Response } from 'express'
import { AuthService } from '../service/AuthService.js'
import { BadRequestError } from '../utils/errors.js'

const authService = new AuthService()

export class AuthController {
  register(req: Request, res: Response): void {
    const result = authService.register(req.body)
    res.status(201).json(result)
  }

  login(req: Request, res: Response): void {
    const { username, password } = req.body
    const result = authService.login(username, password)
    res.json(result)
  }

  me(req: Request, res: Response): void {
    const user = authService.getMe(req.user!.userId)
    res.json(user)
  }

  getAllUsers(req: Request, res: Response): void {
    const includeDisabled = req.query.includeDisabled === 'true'
    const users = authService.getAllUsers(includeDisabled)
    res.json(users)
  }

  getPendingUsers(req: Request, res: Response): void {
    const users = authService.getPendingUsers(req.user!.userId)
    res.json(users)
  }

  approveUser(req: Request, res: Response): void {
    const { approved } = req.body ?? {}
    if (typeof approved !== 'boolean') {
      throw new BadRequestError('缺少 approved 参数（true 批准 / false 拒绝）')
    }
    const user = authService.approveUser(req.params.userId, approved, req.user!.userId)
    res.json(user)
  }

  updateUserOrg(req: Request, res: Response): void {
    const user = authService.updateUserOrg(req.params.userId, req.body.orgUnitId, req.user!.userId)
    res.json(user)
  }

  updateUser(req: Request, res: Response): void {
    const user = authService.updateUser(req.params.userId, req.body, req.user!.userId)
    res.json(user)
  }

  // ── Feature 1: 用户禁用 ──
  disableUser(req: Request, res: Response): void {
    const user = authService.disableUser(req.params.userId, req.user!.userId)
    res.json(user)
  }

  enableUser(req: Request, res: Response): void {
    const user = authService.enableUser(req.params.userId, req.user!.userId)
    res.json(user)
  }

  // ── Feature 4: 密码重置 ──
  changePassword(req: Request, res: Response): void {
    const { oldPassword, newPassword } = req.body
    authService.changePassword(req.user!.userId, oldPassword, newPassword)
    res.json({ message: '密码已修改' })
  }

  adminResetPassword(req: Request, res: Response): void {
    const { newPassword } = req.body
    authService.adminResetPassword(req.params.userId, newPassword, req.user!.userId)
    res.json({ message: '密码已重置' })
  }
}
