import request from './request'

export interface TestFileInfo {
  id: string
  filePath: string
  packageName: 'domain' | 'service' | 'contract' | 'core'
  caseCount: number
}

export interface TestRunSummary {
  filesTotal: number
  filesPassed: number
  filesFailed: number
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
  profileFingerprint: string
  declarationFingerprint: string
}

export interface TestStatus {
  running: boolean
  available: boolean
  reasonCode: string | null
  profileFingerprint: string
  declarationFingerprint: string | null
  fileCount: number
  caseCount: number
  lastResult: TestRunResult | null
}

export function getTestFiles() {
  return request.get<{
    files: TestFileInfo[]
    fileCount: number
    caseCount: number
    available: boolean
    reasonCode: string | null
    profileFingerprint: string
    declarationFingerprint: string | null
  }>('/test/files')
}

export function getTestStatus() {
  return request.get<TestStatus>('/test/status')
}

export function runAllTests() {
  return request.post<TestRunResult>('/test/run', {}, { timeout: 180_000 })
}
