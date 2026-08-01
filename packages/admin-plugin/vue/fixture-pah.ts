import type { Component, MaybeRefOrGetter } from 'vue'

export interface PahViewBlockComponentContributions {
  primary?: {
    component: Component
    props?: unknown
  }
  secondary?: {
    component: Component
    props?: unknown
  }
}

export declare function usePahViewContributions(
  viewId: MaybeRefOrGetter<string | null | undefined>,
  contributions: PahViewBlockComponentContributions,
): void
