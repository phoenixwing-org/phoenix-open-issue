import type { HostUser } from './phoenix-open-issue/adapters/host-user'

export declare function useBase(): {
  process: {
    list: Array<{ path?: string; active?: boolean }>
  }
  menu: {
    perms: string[]
  }
  user: {
    token: string
    info: HostUser | null
    get(): Promise<HostUser>
    logout(): Promise<void>
  }
}
