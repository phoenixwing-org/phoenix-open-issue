import { createApp } from './app.js'
import { config } from './config.js'
import { getDb } from './db/connection.js'

// 启动时自动初始化数据库 + 基础种子（仅 admin + 字典，connection.ts 内自动处理）
getDb()

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
