import type { ExternalAuthProvider, ExternalAuthProviderError } from './types.js'
import type { ExternalAuthProviderId } from '@open-issue/core'
import { FeishuAuthProvider } from './feishu/FeishuAuthProvider.js'
import { config } from '../../config.js'

export type ProviderRegistry = ReadonlyMap<ExternalAuthProviderId, ExternalAuthProvider>

const providers: ProviderRegistry = new Map<ExternalAuthProviderId, ExternalAuthProvider>([
  ['feishu', new FeishuAuthProvider(config.externalAuth.feishu)],
])

export function getExternalAuthProviders(): ProviderRegistry {
  return providers
}

export function isExternalAuthProviderError(error: unknown): error is ExternalAuthProviderError {
  return error instanceof Error && error.name === 'ExternalAuthProviderError' && 'code' in error
}
