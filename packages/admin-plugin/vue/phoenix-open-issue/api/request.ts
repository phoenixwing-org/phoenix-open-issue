import { service } from '/@/cool'

const MODULE_API_PREFIX = 'admin/phoenix-open-issue'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface LegacyResponse<T = any> {
  data: T
}

export interface LegacyRequestConfig {
  params?: Record<string, any>
  headers?: Record<string, string>
  timeout?: number
}

function moduleUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${MODULE_API_PREFIX}${normalized}`
}

async function send<T>(
  method: RequestMethod,
  path: string,
  data?: unknown,
  config: LegacyRequestConfig = {},
): Promise<LegacyResponse<T>> {
  const result = await service.request({
    url: moduleUrl(path),
    // COOL 8 的生成类型暂未列出 PATCH，但 Axios/Host 运行时支持该方法。
    method: method as any,
    data,
    params: config.params,
    headers: config.headers,
    timeout: config.timeout,
  })

  // Phoenix Admin 的 service.request 已经解包 COOL 的 { code, data } 响应。
  // 迁移 facade 只补回旧 View/Store 使用的 Axios 风格 data 外壳。
  return { data: result as T }
}

const request = {
  get<T = any>(path: string, config?: LegacyRequestConfig) {
    return send<T>('GET', path, undefined, config)
  },
  post<T = any>(path: string, data?: unknown, config?: LegacyRequestConfig) {
    return send<T>('POST', path, data, config)
  },
  put<T = any>(path: string, data?: unknown, config?: LegacyRequestConfig) {
    return send<T>('PUT', path, data, config)
  },
  patch<T = any>(path: string, data?: unknown, config?: LegacyRequestConfig) {
    return send<T>('PATCH', path, data, config)
  },
  delete<T = any>(path: string, config?: LegacyRequestConfig) {
    return send<T>('DELETE', path, undefined, config)
  },
}

export default request
