import { Router } from 'express'
import { AuthController } from '../controller/AuthController.js'
import { OrgUnitController } from '../controller/OrgUnitController.js'
import { IssueListController } from '../controller/IssueListController.js'
import { IssueController } from '../controller/IssueController.js'
import { CheckpointController } from '../controller/CheckpointController.js'
import { PushController } from '../controller/PushController.js'
import { SeedController } from '../controller/SeedController.js'
import { DictController } from '../controller/DictController.js'
import { BackupController } from '../controller/BackupController.js'
import { authMiddleware } from '../middleware/auth.js'

// Express 5 Router 泛型为空即可，res 类型由 Response 提供
const router = Router()

const authCtrl = new AuthController()
const orgCtrl = new OrgUnitController()
const listCtrl = new IssueListController()
const issueCtrl = new IssueController()
const cpCtrl = new CheckpointController()
const pushCtrl = new PushController()
const seedCtrl = new SeedController()
const dictCtrl = new DictController()
const backupCtrl = new BackupController()

// wrap -- 将 Promise 或同步 Controller 转为 Express handler
function wrap(fn: (req: any, res: any) => void) {
  return (req: any, res: any, next: any) => {
    try {
      const result = fn(req, res)
      // 如果返回 Promise，catch 传给 next
      if (result instanceof Promise) {
        result.catch(next)
      }
    } catch (e) {
      next(e)
    }
  }
}

 router.post('/seed', authMiddleware, wrap((req, res) => seedCtrl.run(req, res)))
// ---- Dict ----
 router.get('/dict/:groupName', authMiddleware, wrap((req, res) => dictCtrl.getByGroup(req, res)))
 router.get('/dict', authMiddleware, wrap((req, res) => dictCtrl.getAll(req, res)))
 router.post('/dict', authMiddleware, wrap((req, res) => dictCtrl.create(req, res)))
 router.post('/dict/presets', authMiddleware, wrap((req, res) => dictCtrl.applyPreset(req, res)))
 router.put('/dict/:id', authMiddleware, wrap((req, res) => dictCtrl.update(req, res)))
 router.delete('/dict/:id', authMiddleware, wrap((req, res) => dictCtrl.delete(req, res)))
 router.delete('/dict/tag/:tag', authMiddleware, wrap((req, res) => dictCtrl.deleteByTag(req, res)))
// ---- Auth ----
router.post('/auth/register', wrap((req, res) => authCtrl.register(req, res)))
router.post('/auth/login', wrap((req, res) => authCtrl.login(req, res)))
router.get('/auth/me', authMiddleware, wrap((req, res) => authCtrl.me(req, res)))
router.get('/users', authMiddleware, wrap((req, res) => authCtrl.getAllUsers(req, res)))
 router.get('/users/pending', authMiddleware, wrap((req, res) => authCtrl.getPendingUsers(req, res)))
 router.patch('/users/:userId/approve', authMiddleware, wrap((req, res) => authCtrl.approveUser(req, res)))
 router.patch('/users/:userId/org', authMiddleware, wrap((req, res) => authCtrl.updateUserOrg(req, res)))
 router.patch('/users/:userId', authMiddleware, wrap((req, res) => authCtrl.updateUser(req, res)))
 // -- 用户禁用 --
 router.patch('/users/:userId/disable', authMiddleware, wrap((req, res) => authCtrl.disableUser(req, res)))
 router.patch('/users/:userId/enable', authMiddleware, wrap((req, res) => authCtrl.enableUser(req, res)))
 // -- 密码重置 --
 router.patch('/auth/change-password', authMiddleware, wrap((req, res) => authCtrl.changePassword(req, res)))
 router.patch('/users/:userId/reset-password', authMiddleware, wrap((req, res) => authCtrl.adminResetPassword(req, res)))

// ---- Org Units ----
router.get('/org-units', wrap((req, res) => orgCtrl.getTree(req, res)))
router.get('/org-units/:id', wrap((req, res) => orgCtrl.getById(req, res)))
router.post('/org-units', wrap((req, res) => orgCtrl.create(req, res)))
router.put('/org-units/:id', wrap((req, res) => orgCtrl.update(req, res)))
router.delete('/org-units/:id', wrap((req, res) => orgCtrl.delete(req, res)))
router.get('/org-units/:id/users', wrap((req, res) => orgCtrl.getUsers(req, res)))

// ---- Issue Lists ----
router.get('/lists', authMiddleware, wrap((req, res) => listCtrl.getMyLists(req, res)))
  router.get('/lists/all', authMiddleware, wrap((req, res) => listCtrl.getAllLists(req, res)))
  router.get('/lists/archived', authMiddleware, wrap((req, res) => listCtrl.getArchivedLists(req, res)))
router.post('/lists', authMiddleware, wrap((req, res) => listCtrl.create(req, res)))
router.get('/lists/:id', authMiddleware, wrap((req, res) => listCtrl.getById(req, res)))
router.put('/lists/:id', authMiddleware, wrap((req, res) => listCtrl.update(req, res)))
router.delete('/lists/:id', authMiddleware, wrap((req, res) => listCtrl.delete(req, res)))
 router.patch('/lists/:id/archive', authMiddleware, wrap((req, res) => listCtrl.archiveList(req, res)))
router.get('/lists/:id/members', authMiddleware, wrap((req, res) => listCtrl.getMembers(req, res)))
router.post('/lists/:id/members', authMiddleware, wrap((req, res) => listCtrl.addMember(req, res)))
router.delete('/lists/:id/members/:userId', authMiddleware, wrap((req, res) => listCtrl.removeMember(req, res)))
 // -- Owner 转移 --
 router.patch('/lists/:id/transfer-owner', authMiddleware, wrap((req, res) => listCtrl.transferOwner(req, res)))
 router.patch('/lists/:id/members/:userId/role', authMiddleware, wrap((req, res) => listCtrl.updateMemberRole(req, res)))

// ---- Issues ----
router.get('/lists/:listId/issues', authMiddleware, wrap((req, res) => issueCtrl.getIssues(req, res)))
router.post('/lists/:listId/issues', authMiddleware, wrap((req, res) => issueCtrl.create(req, res)))
router.put('/lists/:listId/issues/reorder', authMiddleware, wrap((req, res) => issueCtrl.reorder(req, res)))
router.get('/issues/:id', authMiddleware, wrap((req, res) => issueCtrl.getById(req, res)))
router.put('/issues/:id', authMiddleware, wrap((req, res) => issueCtrl.update(req, res)))
router.patch('/issues/:id/status', authMiddleware, wrap((req, res) => issueCtrl.updateStatus(req, res)))
router.delete('/issues/:id', authMiddleware, wrap((req, res) => issueCtrl.delete(req, res)))
// -- Issue 作废（链接级） --
router.patch('/lists/:listId/issues/:issueId/void', authMiddleware, wrap((req, res) => issueCtrl.voidLink(req, res)))
router.patch('/lists/:listId/issues/:issueId/unvoid', authMiddleware, wrap((req, res) => issueCtrl.unvoidLink(req, res)))

// ---- Checkpoints ----
	router.get('/lists/:listId/checkpoints', authMiddleware, wrap((req, res) => cpCtrl.getByListId(req, res)))
router.get('/issues/:issueId/checkpoints', authMiddleware, wrap((req, res) => cpCtrl.getByIssueId(req, res)))
router.post('/issues/:issueId/checkpoints', authMiddleware, wrap((req, res) => cpCtrl.create(req, res)))
router.put('/checkpoints/:id', authMiddleware, wrap((req, res) => cpCtrl.update(req, res)))
router.delete('/checkpoints/:id', authMiddleware, wrap((req, res) => cpCtrl.delete(req, res)))

// ---- Push ----
router.get('/push/preview', authMiddleware, wrap((req, res) => pushCtrl.preview(req, res)))
router.post('/push', authMiddleware, wrap((req, res) => pushCtrl.push(req, res)))
router.get('/lists/:listId/push-history', authMiddleware, wrap((req, res) => pushCtrl.getListPushHistory(req, res)))
router.get('/push/history', authMiddleware, wrap((req, res) => pushCtrl.getMyPushHistory(req, res)))
router.get('/lists/:listId/incoming-pushes', authMiddleware, wrap((req, res) => pushCtrl.getIncomingPushes(req, res)))
router.patch('/push/:id/handle', authMiddleware, wrap((req, res) => pushCtrl.handlePush(req, res)))

// ---- Backup ----
router.get('/db/export', authMiddleware, wrap((req, res) => backupCtrl.exportDb(req, res)))
router.post('/db/import', authMiddleware, wrap((req, res) => backupCtrl.importDb(req, res)))
router.post('/db/repair-links', authMiddleware, wrap((req, res) => backupCtrl.repairLinks(req, res)))

export default router
