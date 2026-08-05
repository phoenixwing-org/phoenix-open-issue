import type {
  DashboardTasks,
  DashboardTaskScope,
  ExternalBindRequestAdminView,
  UserPublic,
} from '@open-issue/core'
import { getAsyncDb } from '../db/connection.js'
import { getActiveUserAsync } from '../utils/access.js'
import { AuthService } from './AuthService.js'
import { ExternalAuthService } from './ExternalAuthService.js'
import { PushService } from './PushService.js'

export class DashboardTaskService {
  private readonly pushService = new PushService()
  private readonly authService = new AuthService()
  private readonly externalAuthService = new ExternalAuthService()

  async getTasks(userId: string, scope: DashboardTaskScope, limit = 5): Promise<DashboardTasks> {
    const actor = await getActiveUserAsync(getAsyncDb(), userId)
    const pushTasksPromise = this.pushService.getDashboardTasks(userId)
    const adminTasksPromise: Promise<[UserPublic[], ExternalBindRequestAdminView[]]> = actor.systemRole === 'admin'
      ? Promise.all([
          this.authService.getPendingUsers(userId),
          this.externalAuthService.listBindRequests(userId, { status: 'pending' }),
        ])
      : Promise.resolve([[], []])

    const [pushTasks, [pendingUsers, externalBindRequests]] = await Promise.all([
      pushTasksPromise,
      adminTasksPromise,
    ])
    const adminCount = pendingUsers.length + externalBindRequests.length
    const distinctPushCount = new Set([
      ...pushTasks.incomingPushes.map(record => record.id),
      ...pushTasks.outgoingPushes.map(record => record.id),
    ]).size
    return {
      scope,
      incomingPushes: scope === 'incoming' ? pushTasks.incomingPushes.slice(0, limit) : [],
      outgoingPushes: scope === 'outgoing' ? pushTasks.outgoingPushes.slice(0, limit) : [],
      pendingUsers: scope === 'admin' ? pendingUsers.slice(0, limit) : [],
      externalBindRequests: scope === 'admin' ? externalBindRequests.slice(0, limit) : [],
      counts: {
        incoming: pushTasks.incomingPushes.length,
        outgoing: pushTasks.outgoingPushes.length,
        admin: adminCount,
        total: distinctPushCount + adminCount,
      },
    }
  }
}
