import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type JwtPayload } from '../utils/jwt.js'
import { UnauthorizedError } from '../utils/errors.js'
import { getAsyncDb } from '../db/connection.js'
import { getActiveUserAsync } from '../utils/access.js'

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
    const payload = verifyToken(token)
    void getActiveUserAsync(getAsyncDb(), payload.userId)
      .then(user => {
        if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
          throw new UnauthorizedError('认证令牌已失效，请重新登录')
        }
        req.user = payload
        next()
      })
      .catch(() => next(new UnauthorizedError('认证令牌无效、已失效或账号不可用')))
  } catch {
    throw new UnauthorizedError('认证令牌无效或已过期')
  }
}
