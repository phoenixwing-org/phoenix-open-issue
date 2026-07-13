import type { Request } from 'express'
import { BadRequestError } from './errors.js'

export function routeParam(req: Request, name: string): string {
  const value = req.params[name]
  const normalized = Array.isArray(value) ? value[0] : value
  if (!normalized) throw new BadRequestError(`缺少路由参数：${name}`)
  return normalized
}
