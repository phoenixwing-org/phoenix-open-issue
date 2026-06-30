import express from 'express'
import cors from 'cors'
import routes from './routes/index.js'
import { errorHandler } from './middleware/error-handler.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // API routes
  app.use('/api', routes)

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // Global error handler
  app.use(errorHandler)

  return app
}
