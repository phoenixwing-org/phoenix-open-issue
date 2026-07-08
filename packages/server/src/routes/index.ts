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
import { FunctionController } from '../controller/FunctionController.js'
import { authMiddleware } from '../middleware/auth.js'

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
const funcCtrl = new FunctionController()

function wrap(fn: (req: any, res: any) => void) {
  return (req: any, res: any, next: any) => {
    try { const r = fn(req, res); if (r instanceof Promise) r.catch(next) }
    catch (e) { next(e) }
  }
}

// ═══ Seed ═══
router.post('/seed',       authMiddleware, wrap((req, res) => seedCtrl.run(req, res)))
router.get('/seed/status',   authMiddleware, wrap((req, res) => seedCtrl.getSeedStatus(req, res)))
router.post('/seed/test-data', authMiddleware, wrap((req, res) => seedCtrl.addTestData(req, res)))
router.post('/seed/decline',  authMiddleware, wrap((req, res) => seedCtrl.declineTestData(req, res)))

// ═══ Dict ═══
router.get('/dict/:groupName', authMiddleware, wrap((req, res) => dictCtrl.getByGroup(req, res)))
router.get('/dict',            authMiddleware, wrap((req, res) => dictCtrl.getAll(req, res)))
router.post('/dict',           authMiddleware, wrap((req, res) => dictCtrl.create(req, res)))
router.post('/dict/presets',   authMiddleware, wrap((req, res) => dictCtrl.applyPreset(req, res)))
router.put('/dict/:id',        authMiddleware, wrap((req, res) => dictCtrl.update(req, res)))
router.delete('/dict/:id',     authMiddleware, wrap((req, res) => dictCtrl.delete(req, res)))
router.delete('/dict/tag/:tag', authMiddleware, wrap((req, res) => dictCtrl.deleteByTag(req, res)))

// ═══ Auth ═══
router.post('/auth/register', wrap((req, res) => authCtrl.register(req, res)))
router.post('/auth/login',    wrap((req, res) => authCtrl.login(req, res)))
router.get('/auth/me',        authMiddleware, wrap((req, res) => authCtrl.me(req, res)))
router.patch('/auth/change-password', authMiddleware, wrap((req, res) => authCtrl.changePassword(req, res)))

// ═══ User ═══
router.get('/users',                authMiddleware, wrap((req, res) => authCtrl.getAllUsers(req, res)))
router.get('/users/pending',        authMiddleware, wrap((req, res) => authCtrl.getPendingUsers(req, res)))
router.patch('/user/:userId',       authMiddleware, wrap((req, res) => authCtrl.updateUser(req, res)))
router.patch('/user/:userId/approve',      authMiddleware, wrap((req, res) => authCtrl.approveUser(req, res)))
router.patch('/user/:userId/org',          authMiddleware, wrap((req, res) => authCtrl.updateUserOrg(req, res)))
router.patch('/user/:userId/disable',      authMiddleware, wrap((req, res) => authCtrl.disableUser(req, res)))
router.patch('/user/:userId/enable',       authMiddleware, wrap((req, res) => authCtrl.enableUser(req, res)))
router.patch('/user/:userId/reset-password', authMiddleware, wrap((req, res) => authCtrl.adminResetPassword(req, res)))

// ═══ Org Unit ═══
router.get('/org-units',        wrap((req, res) => orgCtrl.getTree(req, res)))
router.get('/org-unit/:id',     wrap((req, res) => orgCtrl.getById(req, res)))
router.post('/org-unit',        wrap((req, res) => orgCtrl.create(req, res)))
router.put('/org-unit/:id',     wrap((req, res) => orgCtrl.update(req, res)))
router.delete('/org-unit/:id',  wrap((req, res) => orgCtrl.delete(req, res)))
router.get('/org-unit/:id/users', wrap((req, res) => orgCtrl.getUsers(req, res)))

// ═══ List ═══
router.get('/lists',           authMiddleware, wrap((req, res) => listCtrl.getMyLists(req, res)))
router.get('/lists/all',       authMiddleware, wrap((req, res) => listCtrl.getAllLists(req, res)))
router.get('/lists/archived',  authMiddleware, wrap((req, res) => listCtrl.getArchivedLists(req, res)))
router.post('/list',           authMiddleware, wrap((req, res) => listCtrl.create(req, res)))
router.get('/list/:id',        authMiddleware, wrap((req, res) => listCtrl.getById(req, res)))
router.put('/list/:id',        authMiddleware, wrap((req, res) => listCtrl.update(req, res)))
router.delete('/list/:id',     authMiddleware, wrap((req, res) => listCtrl.delete(req, res)))
router.patch('/list/:id/archive', authMiddleware, wrap((req, res) => listCtrl.archiveList(req, res)))
router.get('/list/:id/members',   authMiddleware, wrap((req, res) => listCtrl.getMembers(req, res)))
router.post('/list/:id/member',   authMiddleware, wrap((req, res) => listCtrl.addMember(req, res)))
router.delete('/list/:id/member/:userId', authMiddleware, wrap((req, res) => listCtrl.removeMember(req, res)))
router.patch('/list/:id/transfer-owner',  authMiddleware, wrap((req, res) => listCtrl.transferOwner(req, res)))
router.patch('/list/:id/member/:userId/role', authMiddleware, wrap((req, res) => listCtrl.updateMemberRole(req, res)))

// ═══ Issue ═══
router.get('/list/:listId/issues',  authMiddleware, wrap((req, res) => issueCtrl.getIssues(req, res)))
router.post('/list/:listId/issue',  authMiddleware, wrap((req, res) => issueCtrl.create(req, res)))
router.put('/list/:listId/issue/reorder', authMiddleware, wrap((req, res) => issueCtrl.reorder(req, res)))
router.get('/issue/:id',        authMiddleware, wrap((req, res) => issueCtrl.getById(req, res)))
router.put('/issue/:id',        authMiddleware, wrap((req, res) => issueCtrl.update(req, res)))
router.patch('/issue/:id/status', authMiddleware, wrap((req, res) => issueCtrl.updateStatus(req, res)))
router.delete('/issue/:id',     authMiddleware, wrap((req, res) => issueCtrl.delete(req, res)))
router.patch('/list/:listId/issue/:issueId/void',   authMiddleware, wrap((req, res) => issueCtrl.voidLink(req, res)))
router.patch('/list/:listId/issue/:issueId/unvoid', authMiddleware, wrap((req, res) => issueCtrl.unvoidLink(req, res)))

// ═══ Checkpoint ═══
router.get('/list/:listId/checkpoints',    authMiddleware, wrap((req, res) => cpCtrl.getByListId(req, res)))
router.get('/issue/:issueId/checkpoints',  authMiddleware, wrap((req, res) => cpCtrl.getByIssueId(req, res)))
router.post('/issue/:issueId/checkpoint',  authMiddleware, wrap((req, res) => cpCtrl.create(req, res)))
router.put('/checkpoint/:id',              authMiddleware, wrap((req, res) => cpCtrl.update(req, res)))
router.delete('/checkpoint/:id',           authMiddleware, wrap((req, res) => cpCtrl.delete(req, res)))

// ═══ Push ═══
router.get('/push/preview',  authMiddleware, wrap((req, res) => pushCtrl.preview(req, res)))
router.post('/push',         authMiddleware, wrap((req, res) => pushCtrl.push(req, res)))
router.get('/list/:listId/push-history',    authMiddleware, wrap((req, res) => pushCtrl.getListPushHistory(req, res)))
router.get('/push/history',                authMiddleware, wrap((req, res) => pushCtrl.getMyPushHistory(req, res)))
router.get('/list/:listId/incoming-pushes', authMiddleware, wrap((req, res) => pushCtrl.getIncomingPushes(req, res)))
router.patch('/push/:id/handle',           authMiddleware, wrap((req, res) => pushCtrl.handlePush(req, res)))

// ═══ Backup ═══
router.get('/db/export',    authMiddleware, wrap((req, res) => backupCtrl.exportDb(req, res)))
router.post('/db/import',   authMiddleware, wrap((req, res) => backupCtrl.importDb(req, res)))
router.post('/db/repair-links', authMiddleware, wrap((req, res) => backupCtrl.repairLinks(req, res)))

// ═══ Functions ═══
router.get('/functions',          authMiddleware, wrap((req, res) => funcCtrl.list(req, res)))
router.get('/functions/export',   authMiddleware, wrap((req, res) => funcCtrl.exportAll(req, res)))
router.post('/functions',         authMiddleware, wrap((req, res) => funcCtrl.create(req, res)))
router.post('/functions/import',  authMiddleware, wrap((req, res) => funcCtrl.importBatch(req, res)))
router.get('/function/:id',       authMiddleware, wrap((req, res) => funcCtrl.getById(req, res)))
router.put('/function/:id',       authMiddleware, wrap((req, res) => funcCtrl.update(req, res)))
router.delete('/function/:id',    authMiddleware, wrap((req, res) => funcCtrl.delete(req, res)))

export default router
