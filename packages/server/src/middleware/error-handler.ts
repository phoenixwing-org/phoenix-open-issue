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

  if (err.name === 'PayloadTooLargeError' || (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      error: 'PayloadTooLargeError',
      message: '导入文件过大，请联系管理员提高请求体限制',
    })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'InternalServerError',
    message: '服务器内部错误',
  })
}
