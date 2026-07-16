import dotenv from 'dotenv'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { pnwResolveDbConfig } from './db/pnw/pnwDbConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 后端包根目录 packages/server */
export const serverRoot = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(serverRoot, '.env') })
dotenv.config({ path: path.join(serverRoot, '.env.local'), override: true })

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(serverRoot, p)
}

const staticDir = resolvePath(process.env.STATIC_DIR || '../web/dist')
const defaultDbPath = resolvePath(process.env.DB_PATH || '../../data/open-issue.sqlite')
const database = pnwResolveDbConfig(process.env, defaultDbPath)
const nodeEnv = process.env.NODE_ENV || 'development'
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me'
const bootstrapAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || '123456'

if (nodeEnv === 'production') {
  const insecureJwtSecrets = new Set(['dev-secret-change-me', 'change-me-in-production'])
  if (insecureJwtSecrets.has(jwtSecret) || jwtSecret.length < 32) {
    throw new Error('生产环境必须设置至少 32 位、非示例值的 JWT_SECRET')
  }
  if (['123456', 'change-me-to-a-strong-password'].includes(bootstrapAdminPassword) || bootstrapAdminPassword.length < 12) {
    throw new Error('生产环境必须设置至少 12 位的 INITIAL_ADMIN_PASSWORD（也用于无密码备份导入后的重置密码）')
  }
}

function resolveServeStatic(): boolean {
  if (process.env.SERVE_STATIC === 'true' || process.env.SERVE_STATIC === '1') return true
  if (process.env.SERVE_STATIC === 'false' || process.env.SERVE_STATIC === '0') return false
  // 未显式配置时：web 已 build 则自动托管（一体部署）
  return fs.existsSync(path.join(staticDir, 'index.html'))
}

export const config = {
  port: parseInt(process.env.PORT || '3400', 10),
  nodeEnv,
  jwtSecret,
  bootstrapAdminPassword,
  dbPath: database.driver === 'sqlite' ? database.path : defaultDbPath,
  database,
  testReportsDir: resolvePath(process.env.TEST_REPORTS_DIR || '../../data/test-reports'),
  serveStatic: resolveServeStatic(),
  staticDir,
}
