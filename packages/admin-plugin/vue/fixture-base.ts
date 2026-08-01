import type { HostUser } from './phoenix-open-issue/adapters/host-user'

export declare function useBase(): {
  user: {
    token: string
    info: HostUser | null
    get(): Promise<HostUser>
    logout(): Promise<void>
  }
}
