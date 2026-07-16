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

function envEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function commaSeparated(value: string | undefined): string[] {
  return (value || '').split(',').map(item => item.trim()).filter(Boolean)
}

const thirdPartyLoginEnabled = envEnabled(process.env.THIRD_PARTY_LOGIN_ENABLED)
const thirdPartyAccountMode = (process.env.THIRD_PARTY_ACCOUNT_MODE || 'bind_existing').trim()
const feishuRequested = envEnabled(process.env.FEISHU_LOGIN_ENABLED)
const feishuAppId = (process.env.FEISHU_APP_ID || '').trim()
const feishuAppSecret = (process.env.FEISHU_APP_SECRET || '').trim()
const feishuRedirectUri = (process.env.FEISHU_REDIRECT_URI || '').trim()
const feishuAllowedTenantKeys = commaSeparated(process.env.FEISHU_ALLOWED_TENANT_KEYS)
const feishuScopes = (process.env.FEISHU_SCOPES || '').trim().split(/\s+/).filter(Boolean)
const externalAuthFrontendBaseUrl = (process.env.WEB_BASE_URL || (nodeEnv === 'development' ? 'http://localhost:5183' : '')).replace(/\/$/, '')
const feishuEnabled = thirdPartyLoginEnabled && feishuRequested

if (thirdPartyAccountMode !== 'bind_existing') {
  throw new Error('当前仅支持 THIRD_PARTY_ACCOUNT_MODE=bind_existing')
}

if (feishuEnabled && (!feishuAppId || !feishuAppSecret || !feishuRedirectUri)) {
  throw new Error('启用飞书登录时必须设置 FEISHU_APP_ID、FEISHU_APP_SECRET 和 FEISHU_REDIRECT_URI')
}

if (feishuEnabled) {
  let redirectUrl: URL
  try {
    redirectUrl = new URL(feishuRedirectUri)
  } catch {
    throw new Error('FEISHU_REDIRECT_URI 必须是完整的 HTTP(S) URL')
  }
  if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
    throw new Error('FEISHU_REDIRECT_URI 只允许 HTTP(S) 协议')
  }
  if (feishuScopes.includes('offline_access')) {
    throw new Error('飞书登录模式不保存 refresh token，请从 FEISHU_SCOPES 移除 offline_access')
  }
}

if (feishuEnabled && nodeEnv === 'production') {
  if (!feishuRedirectUri.startsWith('https://')) {
    throw new Error('生产环境的 FEISHU_REDIRECT_URI 必须使用 HTTPS')
  }
  if (feishuAllowedTenantKeys.length === 0) {
    throw new Error('生产环境启用飞书登录时必须设置 FEISHU_ALLOWED_TENANT_KEYS')
  }
  if (externalAuthFrontendBaseUrl && !externalAuthFrontendBaseUrl.startsWith('https://')) {
    throw new Error('生产环境的 WEB_BASE_URL 必须使用 HTTPS 或留空使用同域地址')
  }
}

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
  externalAuth: {
    enabled: thirdPartyLoginEnabled,
    accountMode: thirdPartyAccountMode as 'bind_existing',
    stateTtlSeconds: positiveInt(process.env.OAUTH_STATE_TTL_SECONDS, 600),
    ticketTtlSeconds: positiveInt(process.env.OAUTH_TICKET_TTL_SECONDS, 120),
    frontendBaseUrl: externalAuthFrontendBaseUrl,
    feishu: {
      enabled: feishuEnabled,
      appId: feishuAppId,
      appSecret: feishuAppSecret,
      redirectUri: feishuRedirectUri,
      allowedTenantKeys: feishuAllowedTenantKeys,
      scopes: feishuScopes,
      authorizationUrl: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize',
      tokenUrl: 'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
      userInfoUrl: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
    },
  },
}
