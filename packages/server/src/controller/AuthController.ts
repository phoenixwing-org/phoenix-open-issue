import type { Request, Response } from 'express'
import { AuthService } from '../service/AuthService.js'

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

  getAllUsers(_req: Request, res: Response): void {
    const users = authService.getAllUsers()
    res.json(users)
  }

  getPendingUsers(_req: Request, res: Response): void {
    const users = authService.getPendingUsers()
    res.json(users)
  }

  approveUser(req: Request, res: Response): void {
    const user = authService.approveUser(req.params.userId, req.body.approved)
    res.json(user)
  }

  updateUserOrg(req: Request, res: Response): void {
    const user = authService.updateUserOrg(req.params.userId, req.body.orgUnitId)
    res.json(user)
  }

  updateUser(req: Request, res: Response): void {
    const user = authService.updateUser(req.params.userId, req.body)
    res.json(user)
  }
}
