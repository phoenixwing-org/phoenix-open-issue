import { fileURLToPath } from 'node:url'

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    include: [
      'phoenix-open-issue/core/algorithms/*.test.ts',
      'phoenix-open-issue/api/*.test.ts',
      '../test/phoenix-open-issue/domain/*.test.ts',
    ],
  },
}
