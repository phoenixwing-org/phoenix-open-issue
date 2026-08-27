import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const hostRoot = process.env.PHOENIX_ADMIN_VUE_ROOT
  ? path.resolve(process.env.PHOENIX_ADMIN_VUE_ROOT)
  : path.resolve(repoRoot, '../phoenix-admin-vue')

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
        find: 'element-plus',
        replacement: path.join(hostRoot, 'node_modules/element-plus'),
      },
      {
        find: 'typeorm',
        replacement: fileURLToPath(new URL('../test/stubs/typeorm.ts', import.meta.url)),
      },
      {
        find: 'pinia',
        replacement: path.join(hostRoot, 'node_modules/pinia'),
      },
      {
        find: /^vue$/,
        replacement: path.join(hostRoot, 'node_modules/vue'),
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
