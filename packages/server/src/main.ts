import { createApp } from './app.js'
import { config } from './config.js'
import { closeAsyncDb, initializeDb } from './db/connection.js'
import type { Server } from 'node:http'

// 启动时自动初始化数据库 + 基础种子（仅 admin + 字典，connection.ts 内自动处理）
await initializeDb()

const app = createApp()

let activeServer: Server | undefined
let shuttingDown = false

function tryListen(port: number, maxRetries = 10): void {
  const server = app.listen(port, '0.0.0.0', () => {
    activeServer = server
    console.log(`📋 Open Issue List Server running at http://0.0.0.0:${port}`)
    console.log(`   Database: ${config.database.driver === 'sqlite' ? config.database.path : 'PostgreSQL'}`)
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

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n${signal}: closing server and database...`)
  if (activeServer) {
    await new Promise<void>((resolve, reject) => {
      activeServer!.close(error => error ? reject(error) : resolve())
    })
  }
  await closeAsyncDb()
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).then(
      () => process.exit(0),
      error => {
        console.error('Shutdown failed:', error)
        process.exit(1)
      },
    )
  })
}
