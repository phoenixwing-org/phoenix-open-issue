// ============================================================
// 汽车行业 Open Issue 列设计（参考 IATF 16949 / 8D 报告标准）
// ============================================================

// --- 第一层：状态与关闭 ---
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled'
export type CloseReason = 'completed' | 'cancelled' | 'duplicate' | 'transferred' | 'unreproducible'

// --- 第二层：二维决策模型 ---
// 兼容说明：历史 API/数据库字段名保持 priority / severity；
// 产品语义分别为“紧急度 / 重要度”，固定 value 的显示名由内置数据字典管理。
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical'
export type Severity = 'fatal' | 'major' | 'minor' | 'trivial'

// --- 第三层：问题分类（IATF 16949 常见分类） ---
export type IssueCategory =
  | 'appearance'   // 外观
  | 'dimension'    // 尺寸
  | 'function'     // 功能
  | 'process'      // 过程
  | 'safety'       // 安全
  | 'other'        // 其他

// --- 第四层：发现阶段（IATF 16949 / AIAG 检测来源） ---
export type DetectionPhase =
  | 'incoming'     // 来料检验
  | 'in_process'   // 过程检验
  | 'final'        // 终检 / 出厂检验
  | 'customer'     // 客户反馈 / 0公里
  | 'audit'        // 审核发现（内部/外部审核）
  | 'supplier'     // 供应商端发现

// ============================================================
// Interface
// ============================================================

export interface Issue {
  id: string
  listId: string
  /** 主归属列表名称；Issue 被推送到其他列表时用于标识来源。 */
  originListName?: string | null

  // 第一层：基本信息
  issueNo: string                     // 可读编号，如 ISS-2026-0001
  title: string
  description: string

  // 第二层：状态与关闭
  status: IssueStatus
  closeReason: CloseReason | null
  closedBy: string | null

  // 第三层：重要度与紧急度（保留历史字段名，见上方兼容说明）
  priority: IssuePriority              // 紧急度：low → critical
  severity: Severity                   // 重要度：trivial → fatal

  // 第四层：问题分类与发现阶段
  category: IssueCategory | null
  detectionPhase: DetectionPhase | null

  // 第五层：人员与日期
  reporterId: string | null           // 提出人（谁发现的）
  assigneeId: string | null           // 责任人（谁负责解决）
  reporterName?: string | null        // 提出人展示标签（姓名/账号）
  assigneeName?: string | null        // 责任人展示标签（姓名/账号）
  dueDate: string | null              // 计划完成日 YYYY-MM-DD
  completedAt: string | null          // 实际完成时间

  // 元数据
  sortOrder: number
  /** 通用扩展属性；业务字段成熟后应优先升级为独立结构化列或附属表。 */
  extensions: Record<string, unknown>
  /** 当前关联的点检表数量；由 issueListLinks 数据库触发器维护。 */
  listCount: number
  createdBy: string
  creatorName?: string | null         // 录入人展示标签（姓名/账号）
  closedByName?: string | null        // 确认人展示标签（姓名/账号）
  createdAt: string
  updatedAt: string

  // 关联功能
  functionId: string | null
}

export interface CreateIssueInput {
  title: string
  description?: string
  priority?: IssuePriority
  severity?: Severity
  category?: IssueCategory
  detectionPhase?: DetectionPhase
  reporterId?: string
  assigneeId?: string
  dueDate?: string
  issueNo?: string
  functionId?: string
}

export interface UpdateIssueInput {
  title?: string
  description?: string
  issueNo?: string
  status?: IssueStatus
  priority?: IssuePriority
  severity?: Severity
  category?: IssueCategory
  detectionPhase?: DetectionPhase
  reporterId?: string
  assigneeId?: string
  dueDate?: string
  closeReason?: CloseReason
  closedBy?: string
  completedAt?: string
  functionId?: string
}

export interface UpdateStatusInput {
  status: IssueStatus
}

export interface ReorderInput {
  issueIds: string[]
}

// ── Issue-List 连接（链接而非复制） ──
export interface IssueListLink {
  id: string
  issueId: string
  listId: string
  /** 0=不关注（列表默认隐藏），1~5=关注递增 */
  attentionLevel: number
  attentionUpdatedAt: string | null
  attentionUpdatedBy: string | null
  linkedAt: string
  linkedBy: string
}
