import { createApp } from './app.js'
import { config } from './config.js'
import { getDb } from './db/connection.js'

// 启动时自动初始化数据库
getDb()

const app = createApp()

app.listen(config.port, '0.0.0.0', () => {
  console.log(`📋 Open Issue List Server running at http://0.0.0.0:${config.port}`)
  console.log(`   Database: ${config.dbPath}`)
})
