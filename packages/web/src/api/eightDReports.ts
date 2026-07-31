import request from './request'
import type { EightDReportInput } from '@open-issue/core'

export function getEightDReports() {
  return request.get('/eight-d-reports')
}

export function getIssueEightDReports(issueId: string) {
  return request.get(`/issue/${issueId}/eight-d-reports`)
}

export function getEightDReportIssueOptions() {
  return request.get('/eight-d-reports/issue-options')
}

export function createEightDReport(data: EightDReportInput) {
  return request.post('/eight-d-report', data)
}

export function updateEightDReport(id: string, data: EightDReportInput) {
  return request.put(`/eight-d-report/${id}`, data)
}

export function deleteEightDReport(id: string) {
  return request.delete(`/eight-d-report/${id}`)
}
