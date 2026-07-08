import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/core/src/**/*.test.ts',  // 已有 co-located 测试
      'tests/**/*.test.ts',              // 新增集中测试
    ],
  },
})
