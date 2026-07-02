import { createApp } from './app.js'
import { config } from './config.js'
import { getDb } from './db/connection.js'
import { seedDatabase } from './seed.js'

// 启动时自动初始化数据库
getDb()

// 首次启动时自动填充种子数据（admin/123456 等），已有数据则跳过
seedDatabase()

const app = createApp()

function tryListen(port: number, maxRetries = 10): void {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`📋 Open Issue List Server running at http://0.0.0.0:${port}`)
    console.log(`   Database: ${config.dbPath}`)
    if (config.serveStatic) {
      console.log(`   Mode:     unified (API + static)`)
    } else {
      console.log(`   Mode:     API only`)
    }
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      if (maxRetries > 0) {
        console.log(`   Port ${port} in use, trying ${port + 1}...`)
        tryListen(port + 1, maxRetries - 1)
      } else {
        console.error(`❌ No available port found after ${port}..${port + 9}`)
        process.exit(1)
      }
    } else {
      throw err
    }
  })
}

tryListen(config.port)
