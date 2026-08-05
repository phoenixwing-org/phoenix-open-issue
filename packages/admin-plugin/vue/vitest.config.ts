import { fileURLToPath } from 'node:url'

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: [
      {
        find: /^\/\$\//,
        replacement: `${fileURLToPath(new URL('.', import.meta.url))}/`,
      },
      {
        find: '@midwayjs/core',
        replacement: fileURLToPath(new URL('../test/stubs/midway-core.ts', import.meta.url)),
      },
      {
        find: '@midwayjs/typeorm',
        replacement: fileURLToPath(new URL('../test/stubs/midway-typeorm.ts', import.meta.url)),
      },
      {
        find: '@cool-midway/core',
        replacement: fileURLToPath(new URL('../test/stubs/cool-midway-core.ts', import.meta.url)),
      },
      {
        find: 'typeorm',
        replacement: fileURLToPath(new URL('../test/stubs/typeorm.ts', import.meta.url)),
      },
      {
        find: 'pinia',
        replacement: fileURLToPath(new URL('../../../../phoenix-admin-vue/node_modules/pinia', import.meta.url)),
      },
      {
        find: /^vue$/,
        replacement: fileURLToPath(new URL('../../../../phoenix-admin-vue/node_modules/vue', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
    include: [
      'phoenix-open-issue/core/algorithms/*.test.ts',
      'phoenix-open-issue/api/*.test.ts',
      'phoenix-open-issue/stores/*.test.ts',
      '../test/phoenix-open-issue/domain/*.test.ts',
      '../test/phoenix-open-issue/service/*.test.ts',
      '../test/scripts/*.test.ts',
    ],
  },
}
