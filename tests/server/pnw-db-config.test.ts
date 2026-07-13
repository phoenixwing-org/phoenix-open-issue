import { describe, expect, it } from 'vitest'
import { pnwResolveDbConfig } from '../../packages/server/src/db/pnw/pnwDbConfig.js'

describe('pnwResolveDbConfig', () => {
  it('默认保持 SQLite 兼容', () => {
    expect(pnwResolveDbConfig({}, '/data/default.sqlite')).toEqual({
      driver: 'sqlite',
      path: '/data/default.sqlite',
    })
  })

  it('读取 SQLite 路径', () => {
    expect(pnwResolveDbConfig({ DB_DRIVER: 'sqlite', DB_PATH: '/data/app.sqlite' }, 'fallback'))
      .toEqual({ driver: 'sqlite', path: '/data/app.sqlite' })
  })

  it('读取 PostgreSQL 配置', () => {
    expect(pnwResolveDbConfig({
      DB_DRIVER: 'postgres',
      DATABASE_URL: 'postgresql://localhost/openissue',
      DB_POOL_MAX: '20',
      DB_SSL: '1',
    }, 'fallback')).toEqual({
      driver: 'postgres',
      connectionString: 'postgresql://localhost/openissue',
      poolMax: 20,
      ssl: true,
    })
  })

  it('PG 缺少连接串时拒绝启动', () => {
    expect(() => pnwResolveDbConfig({ DB_DRIVER: 'postgres' }, 'fallback'))
      .toThrow(/DATABASE_URL/)
  })

  it('拒绝未知驱动和非法连接池配置', () => {
    expect(() => pnwResolveDbConfig({ DB_DRIVER: 'mysql' }, 'fallback')).toThrow(/不支持/)
    expect(() => pnwResolveDbConfig({
      DB_DRIVER: 'postgres',
      DATABASE_URL: 'postgresql://localhost/openissue',
      DB_POOL_MAX: '0',
    }, 'fallback')).toThrow(/正整数/)
  })
})
