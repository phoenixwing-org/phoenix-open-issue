import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors.js'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'InternalServerError',
    message: '服务器内部错误',
  })
}
