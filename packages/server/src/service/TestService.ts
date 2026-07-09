import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { serverRoot, config } from '../config.js'
import { AppError, ConflictError } from '../utils/errors.js'
import { buildTestReportHtml, type VitestJsonReport } from './testReportHtml.js'

export interface TestFileInfo {
  filePath: string
  packageName: string
  caseCount: number
}

export interface TestRunSummary {
  total: number
  passed: number
  failed: number
  pending: number
  success: boolean
  durationMs: number
}

export interface TestRunResult {
  exitCode: number
  summary: TestRunSummary
  reportUrl: string
  ranAt: string
  runId: string
}

export interface TestStatus {
  running: boolean
  available: boolean
  lastResult: TestRunResult | null
}

const RUN_TIMEOUT_MS = 120_000
const REPORT_URL = '/test-reports/latest/report.html'

interface TestRunMeta {
  exitCode: number
  summary: TestRunSummary
  reportUrl: string
  ranAt: string
  runId: string
}

export class TestService {
  private readonly repoRoot = path.resolve(serverRoot, '../..')
  private readonly reportsRoot = config.testReportsDir
  private readonly latestDir = path.join(this.reportsRoot, 'latest')
  private running = false
  private lastResult: TestRunResult | null = null

  isAvailable(): boolean {
    return fs.existsSync(path.join(this.repoRoot, 'node_modules', 'vitest'))
  }

  getStatus(): TestStatus {
    if (!this.lastResult) {
      this.lastResult = this.loadLastResultFromDisk()
    }
    return {
      running: this.running,
      available: this.isAvailable(),
      lastResult: this.lastResult,
    }
  }

  async listFiles(): Promise<TestFileInfo[]> {
    this.assertAvailable()
    const { stdout } = await this.spawnVitest(['list'])
    const counts = new Map<string, number>()

    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const sep = trimmed.indexOf(' > ')
      if (sep <= 0) continue
      const filePath = trimmed.slice(0, sep).replace(/\\/g, '/')
      counts.set(filePath, (counts.get(filePath) ?? 0) + 1)
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([filePath, caseCount]) => ({
        filePath,
        packageName: this.inferPackage(filePath),
        caseCount,
      }))
  }

  async runAll(): Promise<TestRunResult> {
    this.assertAvailable()
    if (this.running) throw new ConflictError('测试正在运行中，请稍后再试')

    this.running = true
    const runId = new Date().toISOString().replace(/[:.]/g, '-')
    const runDir = path.join(this.reportsRoot, runId)
    const jsonPath = path.join(runDir, 'results.json')
    const ranAt = new Date().toLocaleString('zh-CN', { hour12: false })
    const started = Date.now()

    fs.mkdirSync(runDir, { recursive: true })
    if (fs.existsSync(this.latestDir)) {
      fs.rmSync(this.latestDir, { recursive: true, force: true })
    }
    fs.mkdirSync(this.latestDir, { recursive: true })

    try {
      const { exitCode } = await this.spawnVitest([
        'run',
        '--reporter=default',
        '--reporter=json',
        `--outputFile.json=${jsonPath}`,
      ])

      const reportPath = path.join(this.latestDir, 'report.html')
      const summary = this.writeReport(jsonPath, reportPath, ranAt)

      fs.copyFileSync(reportPath, path.join(runDir, 'report.html'))
      if (fs.existsSync(jsonPath)) {
        fs.copyFileSync(jsonPath, path.join(this.latestDir, 'results.json'))
      }

      const result: TestRunResult = {
        exitCode,
        summary,
        reportUrl: REPORT_URL,
        ranAt,
        runId,
      }
      this.saveRunMeta(result)
      this.lastResult = result
      return result
    } finally {
      this.running = false
      if (!this.lastResult || this.lastResult.runId !== runId) {
        const reportExists = fs.existsSync(path.join(this.latestDir, 'report.html'))
        this.lastResult = {
          exitCode: 1,
          summary: {
            total: 0, passed: 0, failed: 0, pending: 0,
            success: false,
            durationMs: Date.now() - started,
          },
          reportUrl: reportExists ? REPORT_URL : '',
          ranAt,
          runId,
        }
      }
    }
  }

  private saveRunMeta(result: TestRunResult): void {
    const metaPath = path.join(this.latestDir, 'meta.json')
    fs.writeFileSync(metaPath, JSON.stringify(result satisfies TestRunMeta, null, 2), 'utf-8')
  }

  private loadLastResultFromDisk(): TestRunResult | null {
    const reportPath = path.join(this.latestDir, 'report.html')
    if (!fs.existsSync(reportPath)) return null

    const metaPath = path.join(this.latestDir, 'meta.json')
    if (fs.existsSync(metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as TestRunResult
      } catch { /* fall through */ }
    }

    const jsonPath = path.join(this.latestDir, 'results.json')
    if (fs.existsSync(jsonPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as VitestJsonReport
        const durationMs = report.testResults.reduce((sum, f) => {
          return sum + f.assertionResults.reduce((s, a) => s + (a.duration || 0), 0)
        }, 0)
        const stat = fs.statSync(reportPath)
        return {
          exitCode: report.success ? 0 : 1,
          summary: {
            total: report.numTotalTests,
            passed: report.numPassedTests,
            failed: report.numFailedTests,
            pending: report.numPendingTests,
            success: report.success,
            durationMs: Math.round(durationMs),
          },
          reportUrl: REPORT_URL,
          ranAt: stat.mtime.toLocaleString('zh-CN', { hour12: false }),
          runId: 'disk',
        }
      } catch { /* fall through */ }
    }

    const stat = fs.statSync(reportPath)
    return {
      exitCode: 0,
      summary: { total: 0, passed: 0, failed: 0, pending: 0, success: true, durationMs: 0 },
      reportUrl: REPORT_URL,
      ranAt: stat.mtime.toLocaleString('zh-CN', { hour12: false }),
      runId: 'disk',
    }
  }

  private writeReport(jsonPath: string, htmlPath: string, ranAt: string): TestRunSummary {
    if (!fs.existsSync(jsonPath)) {
      const empty: VitestJsonReport = {
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
        success: false,
        startTime: Date.now(),
        testResults: [],
      }
      fs.writeFileSync(htmlPath, buildTestReportHtml(empty, this.repoRoot, ranAt), 'utf-8')
      return { total: 0, passed: 0, failed: 0, pending: 0, success: false, durationMs: 0 }
    }

    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as VitestJsonReport
    fs.writeFileSync(htmlPath, buildTestReportHtml(report, this.repoRoot, ranAt), 'utf-8')

    const durationMs = report.testResults.reduce((sum, f) => {
      return sum + f.assertionResults.reduce((s, a) => s + (a.duration || 0), 0)
    }, 0)

    return {
      total: report.numTotalTests,
      passed: report.numPassedTests,
      failed: report.numFailedTests,
      pending: report.numPendingTests,
      success: report.success,
      durationMs: Math.round(durationMs),
    }
  }

  private inferPackage(filePath: string): string {
    const norm = filePath.replace(/\\/g, '/')
    const m = norm.match(/^packages\/([^/]+)/)
    if (m) return m[1]
    if (norm.startsWith('tests/')) return 'tests'
    return 'root'
  }

  private assertAvailable(): void {
    if (!this.isAvailable()) {
      throw new AppError(503, '当前环境未安装 Vitest，单元测试仅适用于开发/内网环境')
    }
  }

  private spawnVitest(args: string[]): Promise<{ stdout: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const isWin = process.platform === 'win32'
      const child = spawn(isWin ? 'pnpm.cmd' : 'pnpm', ['exec', 'vitest', ...args], {
        cwd: this.repoRoot,
        env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
        shell: isWin,
      })

      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new AppError(504, '测试运行超时'))
      }, RUN_TIMEOUT_MS)

      child.stdout?.on('data', (d) => { stdout += d.toString() })
      child.stderr?.on('data', (d) => { stderr += d.toString() })

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        const exitCode = code ?? 1
        const isRun = args[0] === 'run'
        // vitest run: 0=全过, 1=有失败 — 均视为正常结束
        if (isRun && (exitCode === 0 || exitCode === 1)) {
          resolve({ stdout, exitCode })
        } else if (!isRun && exitCode === 0) {
          resolve({ stdout, exitCode })
        } else {
          reject(new AppError(500, stderr.trim() || stdout.trim() || `vitest 异常退出 (${exitCode})`))
        }
      })
    })
  }
}
