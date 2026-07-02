import dotenv from 'dotenv'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 后端包根目录 packages/server */
export const serverRoot = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(serverRoot, '.env') })
dotenv.config({ path: path.join(serverRoot, '.env.local'), override: true })

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(serverRoot, p)
}

const staticDir = resolvePath(process.env.STATIC_DIR || '../web/dist')

function resolveServeStatic(): boolean {
  if (process.env.SERVE_STATIC === 'true' || process.env.SERVE_STATIC === '1') return true
  if (process.env.SERVE_STATIC === 'false' || process.env.SERVE_STATIC === '0') return false
  // 未显式配置时：web 已 build 则自动托管（一体部署）
  return fs.existsSync(path.join(staticDir, 'index.html'))
}

export const config = {
  port: parseInt(process.env.PORT || '3400', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  dbPath: resolvePath(process.env.DB_PATH || '../../data/open-issue.sqlite'),
  serveStatic: resolveServeStatic(),
  staticDir,
}
