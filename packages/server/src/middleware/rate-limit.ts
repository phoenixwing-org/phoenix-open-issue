import type { Request, Response, NextFunction } from 'express'

interface RateLimitOptions {
  windowMs: number
  max: number
  message: string
}

interface RateBucket {
  count: number
  resetAt: number
}

/** 单实例基础限流；用于保护 OAuth 入口，不依赖第三方存储。 */
export function createRateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, RateBucket>()
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now()
    const address = req.ip || req.socket.remoteAddress || 'unknown'
    const key = `${address}:${req.route?.path || req.path}`
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs }
      buckets.set(key, bucket)
    }
    bucket.count++
    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))))
      res.status(429).json({ error: 'TooManyRequests', message: options.message })
      return
    }
    if (buckets.size > 2_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey)
      }
    }
    next()
  }
}
