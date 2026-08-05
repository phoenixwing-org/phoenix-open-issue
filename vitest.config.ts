import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { openIssueLocalWingAliases } from './scripts/open-issue-wing-mode.mjs'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(import.meta.dirname, 'packages/web/src') },
      ...openIssueLocalWingAliases(),
    ],
  },
  test: {
    server: {
      deps: {
        inline: ['phoenix-wing'],
      },
    },
    include: [
      'packages/core/src/**/*.test.ts',  // 已有 co-located 测试
      'packages/web/src/**/*.test.ts',   // Web 包从自身 Registry 依赖图验收 Wing
      'tests/**/*.test.ts',              // 新增集中测试
    ],
  },
})
