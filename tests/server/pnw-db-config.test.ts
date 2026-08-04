import { describe, expect, it } from 'vitest'
import { pnwResolveDbConfig } from '../../packages/server/src/db/pnw/pnwDbConfig.js'

describe('pnwResolveDbConfig', () => {
  it('无数据库配置时默认 PostgreSQL 并 fail closed', () => {
    expect(() => pnwResolveDbConfig({}))
      .toThrow(/DATABASE_URL/)
  })

  it('SQLite 只允许非生产环境显式 opt-in 和绝对工作副本路径', () => {
    expect(() => pnwResolveDbConfig({
      DB_DRIVER: 'sqlite',
      DB_PATH: '/data/app.sqlite',
    })).toThrow(/ALLOW_LEGACY_SQLITE/)

    expect(() => pnwResolveDbConfig({
      DB_DRIVER: 'sqlite',
      ALLOW_LEGACY_SQLITE: 'true',
    })).toThrow(/显式 DB_PATH/)

    expect(() => pnwResolveDbConfig({
      DB_DRIVER: 'sqlite',
      DB_PATH: 'data/app.sqlite',
      ALLOW_LEGACY_SQLITE: 'true',
    })).toThrow(/绝对路径/)

    expect(pnwResolveDbConfig({
      DB_DRIVER: 'sqlite',
      DB_PATH: '/data/app.sqlite',
      ALLOW_LEGACY_SQLITE: 'true',
      NODE_ENV: 'test',
    }))
      .toEqual({ driver: 'sqlite', path: '/data/app.sqlite' })

    expect(() => pnwResolveDbConfig({
      DB_DRIVER: 'sqlite',
      DB_PATH: '/data/app.sqlite',
      ALLOW_LEGACY_SQLITE: 'true',
      NODE_ENV: 'production',
    })).toThrow(/生产运行时禁止 SQLite/)
  })

  it('DATABASE_URL 在未指定 driver 时直接选择 PostgreSQL', () => {
    expect(pnwResolveDbConfig({
      DATABASE_URL: 'postgresql://localhost/openissue',
      DB_POOL_MAX: '20',
      DB_SSL: '1',
    })).toEqual({
      driver: 'postgres',
      connectionString: 'postgresql://localhost/openissue',
      poolMax: 20,
      ssl: true,
    })
  })

  it('PG 缺少连接串时拒绝启动', () => {
    expect(() => pnwResolveDbConfig({ DB_DRIVER: 'postgres' }))
      .toThrow(/DATABASE_URL/)
  })

  it('拒绝 PostgreSQL 与 legacy SQLite 配置混用', () => {
    expect(() => pnwResolveDbConfig({
      DB_DRIVER: 'postgres',
      DATABASE_URL: 'postgresql://localhost/openissue',
      DB_PATH: '/data/app.sqlite',
    })).toThrow(/不能设置 DB_PATH/)
    expect(() => pnwResolveDbConfig({
      DB_DRIVER: 'sqlite',
      DB_PATH: '/data/app.sqlite',
      ALLOW_LEGACY_SQLITE: 'true',
      DATABASE_URL: 'postgresql://localhost/openissue',
    })).toThrow(/不能同时设置 DATABASE_URL/)
  })

  it('拒绝未知驱动和非法连接池配置', () => {
    expect(() => pnwResolveDbConfig({ DB_DRIVER: 'mysql' })).toThrow(/不支持/)
    expect(() => pnwResolveDbConfig({
      DB_DRIVER: 'postgres',
      DATABASE_URL: 'postgresql://localhost/openissue',
      DB_POOL_MAX: '0',
    })).toThrow(/正整数/)
  })
})
