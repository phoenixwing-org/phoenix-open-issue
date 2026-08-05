export interface ModuleConfig {
  order?: number
  views?: Array<{
    path: string
    redirect?: string
  }>
}

export interface HostRequestOptions {
  url?: string
  method?: string
  data?: unknown
  params?: unknown
  headers?: Record<string, string>
  timeout?: number
}

export declare const service: {
  request(options: HostRequestOptions): Promise<unknown>
  dict: {
    info: {
      data(params: { types: string[] }): Promise<Record<string, unknown[]>>
    }
  }
  base: {
    sys: {
      user: {
        list(params?: unknown): Promise<unknown[]>
        update(data: { id: number; status: number }): Promise<void>
      }
    }
  }
}
