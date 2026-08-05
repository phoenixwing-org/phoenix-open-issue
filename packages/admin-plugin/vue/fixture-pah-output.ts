export interface PahWorkbenchOutput {
  append(value: string): void
  appendLine(value: string): void
  replace(value: string): void
  clear(): void
}

export declare function usePahWorkbenchOutput(): PahWorkbenchOutput | undefined
