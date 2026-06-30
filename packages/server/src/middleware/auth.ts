import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type JwtPayload } from '../utils/jwt.js'
import { UnauthorizedError } from '../utils/errors.js'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('缺少认证令牌')
  }

  const token = header.slice(7)
  try {
    req.user = verifyToken(token)
    next()
  } catch {
    throw new UnauthorizedError('认证令牌无效或已过期')
  }
}
