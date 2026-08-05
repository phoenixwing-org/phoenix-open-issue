import request from './request'
import type { PushRequest } from '@open-issue/core'

export function previewPush(fromListId: string, toListId: string) {
  return request.get('/push/preview', { params: { fromListId, toListId } })
}

export function pushIssues(data: PushRequest) {
  return request.post('/push', data)
}

export function getListPushHistory(listId: string) {
  return request.get(`/list/${listId}/push-history`)
}

export function getMyPushHistory() {
  return request.get('/push/history')
}

export function getIncomingPushes(listId: string) {
  return request.get(`/list/${listId}/incoming-pushes`)
}

export function getPushTargetLists(recordId: string) {
  return request.get(`/push/${recordId}/target-lists`)
}

export function handlePush(recordId: string, action: 'accepted' | 'rejected', rejectReason?: string, toListId?: string) {
  return request.patch(`/push/${recordId}/handle`, { action, rejectReason, toListId })
}

export function withdrawPush(recordId: string) {
  return request.patch(`/push/${recordId}/withdraw`)
}

export function runSeed(force = false) {
  return request.post('/seed' + (force ? '?force=true' : ''))
}

export function getSeedStatus() {
  return request.get('/seed/status')
}

export function addTestData() {
  return request.post('/seed/test-data')
}

export function declineTestData() {
  return request.post('/seed/decline')
}
