import type { HostUser } from './phoenix-open-issue/adapters/host-user'

export declare function useBase(): {
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
