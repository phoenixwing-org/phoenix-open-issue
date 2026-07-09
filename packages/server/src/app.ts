import express, { type Express } from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import routes from './routes/index.js'
import { errorHandler } from './middleware/error-handler.js'
import { config } from './config.js'

export function createApp(): Express {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.use('/api', routes)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // 单元测试 HTML 报告（独立页面，新标签打开）
  fs.mkdirSync(config.testReportsDir, { recursive: true })
  app.use('/test-reports', express.static(config.testReportsDir))

  if (config.serveStatic) {
    app.use(express.static(config.staticDir))

    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      if (req.path.startsWith('/api')) return next()
      if (req.path.startsWith('/test-reports')) return next()
      const indexHtml = path.join(config.staticDir, 'index.html')
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml)
      } else {
        next()
      }
    })
  }

  app.use(errorHandler)

  return app
}
