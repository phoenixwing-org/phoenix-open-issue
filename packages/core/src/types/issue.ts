// ============================================================
// 汽车行业 Open Issue 列设计（参考 IATF 16949 / 8D 报告标准）
// ============================================================

// --- 第一层：状态与关闭 ---
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled'
export type CloseReason = 'completed' | 'cancelled' | 'duplicate' | 'transferred' | 'unreproducible'

// --- 第二层：优先级与严重度 ---
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

  // 第一层：基本信息
  issueNo: string                     // 可读编号，如 ISS-2026-0001
  title: string
  description: string

  // 第二层：状态与关闭
  status: IssueStatus
  closeReason: CloseReason | null
  closedBy: string | null

  // 第三层：优先级与严重度
  priority: IssuePriority
  severity: Severity

  // 第四层：问题分类与发现阶段
  category: IssueCategory | null
  detectionPhase: DetectionPhase | null

  // 第五层：人员与日期
  reporterId: string | null           // 提出人（谁发现的）
  assigneeId: string | null           // 责任人（谁负责解决）
  dueDate: string | null              // 计划完成日 YYYY-MM-DD
  completedAt: string | null          // 实际完成时间

  // 第六层：8D 报告字段（D3-D6）
  containment: string | null          // D3 临时遏制措施
  rootCause: string | null            // D4 根本原因
  correctiveAction: string | null     // D5-D6 永久纠正措施

  // 元数据
  sortOrder: number
  createdBy: string
  createdAt: string
  updatedAt: string
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
  containment?: string
  rootCause?: string
  correctiveAction?: string
}

export interface UpdateIssueInput {
  title?: string
  description?: string
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
  containment?: string
  rootCause?: string
  correctiveAction?: string
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
  voided: number
  voidedAt: string | null
  voidedBy: string | null
  linkedAt: string
  linkedBy: string
}
