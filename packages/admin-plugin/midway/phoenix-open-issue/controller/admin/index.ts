import {
  ALL,
  Body,
  Del,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Provide,
  Put,
  Query,
} from "@midwayjs/core";
import { BaseController, CoolController } from "@cool-midway/core";
import { OpenIssueCheckpointService } from "../../service/checkpoint";
import { OpenIssueEightDReportService } from "../../service/eight-d-report";
import { OpenIssueFunctionService } from "../../service/function";
import { OpenIssueService } from "../../service/issue";
import { OpenIssueListService } from "../../service/issue-list";
import { OpenIssueLegacyImportService } from "../../service/legacy-import";
import { OpenIssueMaintenanceService } from "../../service/maintenance";
import { OpenIssuePushService } from "../../service/push";
import { OpenIssueTestRunnerService } from "../../service/test-runner";

@Provide()
@CoolController("/admin/phoenix-open-issue")
export class OpenIssueAdminController extends BaseController {
  @Inject()
  openIssueListService: OpenIssueListService;

  @Inject()
  openIssueService: OpenIssueService;

  @Inject()
  openIssueCheckpointService: OpenIssueCheckpointService;

  @Inject()
  openIssueEightDReportService: OpenIssueEightDReportService;

  @Inject()
  openIssueFunctionService: OpenIssueFunctionService;

  @Inject()
  openIssueMaintenanceService: OpenIssueMaintenanceService;

  @Inject()
  openIssueLegacyImportService: OpenIssueLegacyImportService;

  @Inject()
  openIssuePushService: OpenIssuePushService;

  @Inject()
  openIssueTestRunnerService: OpenIssueTestRunnerService;

  @Get("/lists", { summary: "查询我可访问的问题列表" })
  async lists(@Query("includeArchived") includeArchived: unknown) {
    return this.ok(await this.openIssueListService.myLists(includeArchived));
  }

  @Get("/lists/all", { summary: "Host 管理员查询全部问题列表" })
  async allLists(
    @Query("includeArchived") includeArchived: unknown,
    @Query("includeDeleted") includeDeleted: unknown
  ) {
    return this.ok(
      await this.openIssueListService.allLists(includeArchived, includeDeleted)
    );
  }

  @Get("/lists/archived", { summary: "查询已归档问题列表" })
  async archivedLists() {
    return this.ok(await this.openIssueListService.archivedLists());
  }

  @Get("/lists/deleted", { summary: "Host 管理员查询已删除问题列表" })
  async deletedLists() {
    return this.ok(await this.openIssueListService.deletedLists());
  }

  @Get("/list/:id", { summary: "查询问题列表详情" })
  async getList(@Param("id") id: string) {
    return this.ok(await this.openIssueListService.get(id));
  }

  @Post("/list", { summary: "创建问题列表" })
  async createList(@Body(ALL) input: unknown) {
    return this.ok(await this.openIssueListService.create(input));
  }

  @Put("/list/:id", { summary: "更新问题列表" })
  async updateList(@Param("id") id: string, @Body(ALL) input: unknown) {
    return this.ok(await this.openIssueListService.update(id, input));
  }

  @Del("/list/:id", { summary: "软删除问题列表" })
  async deleteList(@Param("id") id: string) {
    await this.openIssueListService.delete(id);
    return this.ok();
  }

  @Patch("/list/:id/archive", { summary: "归档或取消归档问题列表" })
  async archiveList(
    @Param("id") id: string,
    @Body("archived") archived: unknown
  ) {
    return this.ok(await this.openIssueListService.archive(id, archived));
  }

  @Patch("/list/:id/restore", { summary: "恢复已删除问题列表" })
  async restoreList(@Param("id") id: string) {
    return this.ok(await this.openIssueListService.restore(id));
  }

  @Get("/list/:id/members", { summary: "查询问题列表成员" })
  async listMembers(@Param("id") id: string) {
    return this.ok(await this.openIssueListService.members(id));
  }

  @Post("/list/:id/member", { summary: "添加问题列表成员" })
  async addListMember(
    @Param("id") id: string,
    @Body("userId") userId: unknown,
    @Body("role") role: unknown
  ) {
    return this.ok(await this.openIssueListService.addMember(id, userId, role));
  }

  @Del("/list/:id/member/:userId", { summary: "移除问题列表成员" })
  async removeListMember(
    @Param("id") id: string,
    @Param("userId") userId: string
  ) {
    await this.openIssueListService.removeMember(id, userId);
    return this.ok();
  }

  @Patch("/list/:id/member/:userId/role", { summary: "更新问题列表成员角色" })
  async updateListMemberRole(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body("role") role: unknown
  ) {
    return this.ok(
      await this.openIssueListService.updateMemberRole(id, userId, role)
    );
  }

  @Patch("/list/:id/transfer-owner", { summary: "转移问题列表负责人" })
  async transferListOwner(
    @Param("id") id: string,
    @Body("userId") userId: unknown
  ) {
    return this.ok(await this.openIssueListService.transferOwner(id, userId));
  }

  @Get("/list/:id/issues", { summary: "查询列表中的 Issue" })
  async issues(
    @Param("id") id: string,
    @Query("status") status: unknown,
    @Query("priority") priority: unknown,
    @Query("search") search: unknown,
    @Query("sort") sort: unknown,
    @Query("page") page: unknown,
    @Query("size") size: unknown
  ) {
    return this.ok(
      await this.openIssueService.list(id, {
        status,
        priority,
        search,
        sort,
        page,
        size,
      })
    );
  }

  @Post("/list/:id/issue", { summary: "创建 Issue" })
  async createIssue(@Param("id") id: string, @Body(ALL) input: unknown) {
    return this.ok(await this.openIssueService.create(id, input));
  }

  @Get("/issue/:id", { summary: "查询 Issue 详情" })
  async getIssue(@Param("id") id: string) {
    return this.ok(await this.openIssueService.get(id));
  }

  @Put("/issue/:id", { summary: "更新 Issue" })
  async updateIssue(@Param("id") id: string, @Body(ALL) input: unknown) {
    return this.ok(await this.openIssueService.update(id, input));
  }

  @Patch("/issue/:id/status", { summary: "更新 Issue 状态" })
  async updateIssueStatus(
    @Param("id") id: string,
    @Body("status") status: unknown
  ) {
    return this.ok(await this.openIssueService.updateStatus(id, status));
  }

  @Del("/issue/:id", { summary: "取消 Issue" })
  async deleteIssue(@Param("id") id: string) {
    await this.openIssueService.delete(id);
    return this.ok();
  }

  @Put("/list/:id/issue/reorder", { summary: "重排 Issue" })
  async reorderIssues(@Param("id") id: string, @Body(ALL) input: unknown) {
    await this.openIssueService.reorder(id, input);
    return this.ok();
  }

  @Patch("/list/:id/issue/:issueId/attention", { summary: "调整 Issue 关注度" })
  async setIssueAttention(
    @Param("id") id: string,
    @Param("issueId") issueId: string,
    @Body("attentionLevel") attentionLevel: unknown
  ) {
    return this.ok(
      await this.openIssueService.setAttention(id, issueId, attentionLevel)
    );
  }

  @Get("/issue/:id/checkpoints", { summary: "查询 Issue 点检项" })
  async issueCheckpoints(@Param("id") id: string) {
    return this.ok(await this.openIssueCheckpointService.byIssue(id));
  }

  @Get("/list/:id/checkpoints", { summary: "按 Issue 分组查询列表点检项" })
  async listCheckpoints(@Param("id") id: string) {
    return this.ok(await this.openIssueCheckpointService.byList(id));
  }

  @Post("/issue/:id/checkpoint", { summary: "创建点检项" })
  async createCheckpoint(@Param("id") id: string, @Body(ALL) input: unknown) {
    return this.ok(await this.openIssueCheckpointService.create(id, input));
  }

  @Put("/checkpoint/:id", { summary: "更新点检项" })
  async updateCheckpoint(@Param("id") id: string, @Body(ALL) input: unknown) {
    return this.ok(await this.openIssueCheckpointService.update(id, input));
  }

  @Del("/checkpoint/:id", { summary: "作废点检项" })
  async deleteCheckpoint(@Param("id") id: string) {
    await this.openIssueCheckpointService.delete(id);
    return this.ok();
  }

  @Get("/functions", { summary: "查询 Open Issue 功能简表" })
  async functions(
    @Query("search") search: unknown,
    @Query("platform") platform: unknown,
    @Query("sort") sort: unknown,
    @Query("numericSort") numericSort: unknown,
    @Query("enabled") enabled: unknown
  ) {
    return this.ok(
      await this.openIssueFunctionService.list({
        search,
        platform,
        sort,
        numericSort,
        enabled,
      })
    );
  }

  @Get("/functions/export", { summary: "导出 Open Issue 功能简表" })
  async exportFunctions() {
    return this.ok(await this.openIssueFunctionService.export());
  }

  @Post("/functions", { summary: "创建功能" })
  async createFunction(@Body(ALL) input: unknown) {
    return this.ok(await this.openIssueFunctionService.create(input));
  }

  @Post("/functions/import", { summary: "导入功能简表" })
  async importFunctions(@Body(ALL) input: unknown) {
    return this.ok(await this.openIssueFunctionService.import(input));
  }

  @Get("/function/:id", { summary: "查询功能详情" })
  async getFunction(@Param("id") id: string) {
    return this.ok(await this.openIssueFunctionService.get(id));
  }

  @Put("/function/:id", { summary: "更新功能" })
  async updateFunction(@Param("id") id: string, @Body(ALL) input: unknown) {
    return this.ok(await this.openIssueFunctionService.update(id, input));
  }

  @Del("/function/:id", { summary: "停用功能" })
  async deleteFunction(@Param("id") id: string) {
    await this.openIssueFunctionService.delete(id);
    return this.ok();
  }

  @Patch("/function/:id/enabled", { summary: "启用或停用功能" })
  async setFunctionEnabled(
    @Param("id") id: string,
    @Body("enabled") enabled: unknown
  ) {
    return this.ok(await this.openIssueFunctionService.setEnabled(id, enabled));
  }

  @Get("/eight-d-reports", { summary: "查询可访问的 8D 报告" })
  async eightDReports() {
    return this.ok(await this.openIssueEightDReportService.list());
  }

  @Get("/eight-d-reports/issue-options", {
    summary: "查询可关联 8D 报告的 Issue",
  })
  async eightDReportIssueOptions() {
    return this.ok(await this.openIssueEightDReportService.issueOptions());
  }

  @Get("/issue/:id/eight-d-reports", { summary: "查询 Issue 的 8D 报告" })
  async issueEightDReports(@Param("id") id: string) {
    return this.ok(await this.openIssueEightDReportService.byIssue(id));
  }

  @Get("/eight-d-report/:id", { summary: "查询 8D 报告详情" })
  async getEightDReport(@Param("id") id: string) {
    return this.ok(await this.openIssueEightDReportService.get(id));
  }

  @Post("/eight-d-report", { summary: "创建 8D 报告" })
  async createEightDReport(@Body(ALL) input: unknown) {
    return this.ok(await this.openIssueEightDReportService.create(input));
  }

  @Put("/eight-d-report/:id", { summary: "更新 8D 报告" })
  async updateEightDReport(
    @Param("id") id: string,
    @Body(ALL) input: unknown
  ) {
    return this.ok(await this.openIssueEightDReportService.update(id, input));
  }

  @Del("/eight-d-report/:id", { summary: "软删除 8D 报告" })
  async deleteEightDReport(@Param("id") id: string) {
    await this.openIssueEightDReportService.delete(id);
    return this.ok();
  }

  @Get("/push/preview", { summary: "预检 Issue 列表推送" })
  async previewPush(
    @Query("fromListId") fromListId: string,
    @Query("toListId") toListId: string
  ) {
    return this.ok(
      await this.openIssuePushService.preview(fromListId, toListId)
    );
  }

  @Post("/push", { summary: "发起 Issue 推送" })
  async pushIssues(@Body(ALL) input: unknown) {
    return this.ok(await this.openIssuePushService.push(input));
  }

  @Get("/push/history", { summary: "查询我的可见推送历史" })
  async pushHistory() {
    return this.ok(await this.openIssuePushService.history());
  }

  @Get("/list/:id/push-history", { summary: "查询列表推送历史" })
  async listPushHistory(@Param("id") id: string) {
    return this.ok(await this.openIssuePushService.listHistory(id));
  }

  @Get("/list/:id/incoming-pushes", { summary: "查询列表待处理推送" })
  async incomingPushes(@Param("id") id: string) {
    return this.ok(await this.openIssuePushService.incoming(id));
  }

  @Get("/push/:id/target-lists", {
    summary: "查询用户推送可接受到的列表",
  })
  async pushTargetLists(@Param("id") id: string) {
    return this.ok(await this.openIssuePushService.targetLists(id));
  }

  @Patch("/push/:id/handle", { summary: "接受或拒绝推送" })
  async handlePush(
    @Param("id") id: string,
    @Body("action") action: unknown,
    @Body("rejectReason") rejectReason: unknown,
    @Body("toListId") toListId: unknown
  ) {
    return this.ok(
      await this.openIssuePushService.handle(
        id,
        action,
        rejectReason,
        toListId
      )
    );
  }

  @Patch("/push/:id/withdraw", { summary: "撤回待处理推送" })
  async withdrawPush(@Param("id") id: string) {
    return this.ok(await this.openIssuePushService.withdraw(id));
  }

  @Get("/dashboard/tasks", { summary: "查询 Open Issue 待办中心" })
  async dashboardTasks(
    @Query("tab") tab: unknown,
    @Query("limit") limit: unknown
  ) {
    return this.ok(await this.openIssuePushService.dashboard(tab, limit));
  }

  @Get("/maintenance/repair-tasks", {
    summary: "查询 Open Issue 可执行的数据修正任务",
  })
  async repairTasks() {
    return this.ok(this.openIssueMaintenanceService.tasks());
  }

  @Get("/maintenance/repair-plan", {
    summary: "只读生成 Open Issue 数据修正计划",
  })
  async repairPlan(@Query("task") task: unknown) {
    return this.ok(await this.openIssueMaintenanceService.plan(task));
  }

  @Get("/maintenance/repair-ledger", {
    summary: "查询 Open Issue 数据修正审计记录",
  })
  async repairLedger(
    @Query("page") page: unknown,
    @Query("size") size: unknown
  ) {
    return this.ok(await this.openIssueMaintenanceService.ledger(page, size));
  }

  @Post("/maintenance/repair", {
    summary: "按已确认 dry-run 执行 Open Issue 幂等数据修正",
  })
  async repair(
    @Body("task") task: unknown,
    @Body("fingerprint") fingerprint: unknown,
    @Body("generatedAt") generatedAt: unknown,
    @Body("confirmed") confirmed: unknown
  ) {
    return this.ok(
      await this.openIssueMaintenanceService.run(task, {
        fingerprint,
        generatedAt,
        confirmed,
      })
    );
  }

  @Post("/maintenance/legacy-import/plan", {
    summary: "只读规划旧站 Open Issue 业务数据迁移",
  })
  async legacyImportPlan(@Body(ALL) input: unknown) {
    const value = input && typeof input === "object" ? input : {};
    return this.ok(
      await this.openIssueLegacyImportService.plan({
        package: (value as Record<string, unknown>).package,
        mappings: (value as Record<string, unknown>).mappings,
      })
    );
  }

  @Post("/maintenance/legacy-import/execute", {
    summary: "按已确认计划导入核心业务并独立尝试可选 8D",
  })
  async legacyImportExecute(
    @Body("planId") planId: unknown,
    @Body("confirmed") confirmed: unknown,
    @Body("backupConfirmed") backupConfirmed: unknown
  ) {
    return this.ok(
      await this.openIssueLegacyImportService.execute(planId, {
        confirmed,
        backupConfirmed,
      })
    );
  }

  @Get("/test/files", { summary: "查询 Open Issue 单元测试文件" })
  async testFiles() {
    return this.ok(await this.openIssueTestRunnerService.catalog());
  }

  @Get("/test/status", { summary: "查询 Open Issue 单元测试状态" })
  async testStatus() {
    return this.ok(await this.openIssueTestRunnerService.status());
  }

  @Post("/test/run", { summary: "运行 Open Issue 声明的单元测试" })
  async runTests() {
    return this.ok(await this.openIssueTestRunnerService.runAll());
  }
}
