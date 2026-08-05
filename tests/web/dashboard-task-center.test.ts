import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

describe('仪表盘待办中心', () => {
  it('仪表盘 Header 同行显示平级 Tab，并把列表操作收进概览', () => {
    const dashboard = read('packages/web/src/views/DashboardView.vue')
    expect(dashboard).toContain("import DashboardTaskCenter from '@/components/dashboard/DashboardTaskCenter.vue'")
    expect(dashboard).toContain('<template #actions>')
    expect(dashboard).toContain('class="dashboard-header-tabs"')
    expect(dashboard).toContain('v-model:active-tab="activeDashboardTab"')
    expect(dashboard).toContain('<template #overview>')
    expect(dashboard).toContain('class="dashboard-overview-toolbar"')
    expect(dashboard).toContain('data-tour="dashboard-cards"')
    expect(dashboard).toContain('background: var(--pnw-workbench-surface')
    expect(dashboard).toContain('color: var(--pnw-workbench-text')
  })

  it('按职责提供概览与三个平级 Tab、数量、空状态和完整页面跳转', () => {
    const center = read('packages/web/src/components/dashboard/DashboardTaskCenter.vue')
    const dashboard = read('packages/web/src/views/DashboardView.vue')
    expect(dashboard).toContain("@click=\"selectDashboardTab('overview')\"")
    expect(dashboard).toContain('待我处理')
    expect(dashboard).toContain('我发起的')
    expect(dashboard).toContain('管理审批')
    expect(center).toContain('<slot name="overview" />')
    expect(center).toContain("v-else-if=\"activeTab === 'admin' && isAdmin\"")
    expect(center).toContain("defineModel<DashboardSection>('activeTab'")
    expect(center).toContain("emit('countsChange', response.data.counts)")
    expect(center).toContain("openTab('pushHistory', '推送历史')")
    expect(center).toContain("openTab('org', '组织架构')")
    expect(center).toContain('目前没有需要你处理的推送')
  })

  it('复用推送与用户审批接口完成快捷操作', () => {
    const center = read('packages/web/src/components/dashboard/DashboardTaskCenter.vue')
    const api = read('packages/web/src/api/dashboard.ts')
    expect(api).toContain("request.get<DashboardTasks>('/dashboard/tasks',")
    expect(center).toContain("handlePush(record.id, 'accepted')")
    expect(center).toContain("handlePush(record.id, 'rejected'")
    expect(center).toContain('withdrawPush(record.id)')
    expect(center).toContain('approveUser(user.id, true)')
    expect(center).toContain('MAX_VISIBLE_TASKS = 5')
    expect(center).toContain("scheduleLoad('summary')")
    expect(center).toContain('watch(activeTab')
    expect(center).toContain('releaseTaskData()')
    expect(center).toContain("v-else-if=\"activeTab === 'incoming'\"")
    expect(center).not.toContain('<el-tabs')
    expect(api).toContain("params: { tab, limit }")
  })
})
