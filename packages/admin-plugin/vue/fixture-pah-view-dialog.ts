import type {
  PnwColorScheme,
  PnwFloatingPanelPosition,
  PnwPresentationResizeMode,
  PnwViewDialogOutcome,
  PnwViewDialogSize,
} from 'phoenix-wing'
import type { Component } from 'vue'

export interface PhoenixViewDialogRendererContribution {
  readonly rendererId: string
  readonly load: () => Promise<Component | { default: Component }>
  readonly movable?: boolean
  readonly resizable?: boolean | PnwPresentationResizeMode
}

export interface PhoenixViewDialogOpenRequest<TProps> {
  readonly rendererId: string
  readonly instanceKey?: string
  readonly title: string
  readonly props: TProps
  readonly size?: Partial<PnwViewDialogSize>
  readonly colorScheme?: PnwColorScheme
  readonly position?: PnwFloatingPanelPosition
}

export interface PhoenixViewDialogApi {
  open<TProps, TResult = unknown>(
    request: PhoenixViewDialogOpenRequest<TProps>,
  ): Promise<PnwViewDialogOutcome<TResult>>
}

export declare function usePhoenixViewDialog(): PhoenixViewDialogApi
