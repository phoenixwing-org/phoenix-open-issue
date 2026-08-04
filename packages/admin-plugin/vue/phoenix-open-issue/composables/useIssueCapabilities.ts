import { useBase } from '/$/base'
import {
  hasIssueHostCapability,
  type IssueHostCapability,
} from '/$/phoenix-open-issue/core'

/** Read-only adapter over Cool's role/menu permission state. */
export function useIssueCapabilities() {
  const { menu } = useBase()

  function has(permission: string): boolean {
    return Boolean(menu.perms?.some(item => item === permission))
  }

  function can(capability: IssueHostCapability): boolean {
    return hasIssueHostCapability(menu.perms, capability)
  }

  return { can, has }
}
