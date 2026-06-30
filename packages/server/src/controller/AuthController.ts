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
}
