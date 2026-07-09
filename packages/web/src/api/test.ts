import request from './request'

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
  message?: string
}

export interface TestStatus {
  running: boolean
  available: boolean
  lastResult: TestRunResult | null
}

export function getTestFiles() {
  return request.get<{ files: TestFileInfo[]; available: boolean }>('/test/files')
}

export function getTestStatus() {
  return request.get<TestStatus>('/test/status')
}

export function runAllTests() {
  return request.post<TestRunResult>('/test/run', {}, { timeout: 180_000 })
}
