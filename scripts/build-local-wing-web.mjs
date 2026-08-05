import { spawn } from 'node:child_process'

const tsconfig = process.env.OPEN_ISSUE_LOCAL_WING_TSCONFIG
if (!tsconfig || process.env.PHOENIX_WING_MODE !== 'local') {
  console.error('请通过根目录 pnpm build:local-wing 运行本地 Wing 构建')
  process.exit(2)
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { stdio: 'inherit', env: process.env })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`pnpm ${args.join(' ')} 退出码 ${code}`)))
  })
}

try {
  await run(['exec', 'vue-tsc', '-p', tsconfig, '--noEmit', '--pretty', 'false'])
  await run(['exec', 'vite', 'build'])
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
