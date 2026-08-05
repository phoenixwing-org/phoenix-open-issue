export type ListViewMode = 'simple' | 'complex' | 'timeline'

export type IssueColumnKey =
  | 'issueNo'
  | 'severity'
  | 'priority'
  | 'category'
  | 'detectionPhase'
  | 'function'
  | 'reporter'
  | 'assignee'
  | 'dueDate'
  | 'attention'
  | 'status'
  | 'createdAt'
  | 'checkpoints'

export interface IssueColumnItemConfig {
  key: IssueColumnKey
  visible: boolean
}

export type IssueListColumnSettings = Record<ListViewMode, IssueColumnItemConfig[]>

const ALL_VIEW_MODES: ListViewMode[] = ['simple', 'complex', 'timeline']

export interface IssueColumnMeta {
  key: IssueColumnKey
  label: string
  /** 列设置里该视图是否可选 */
  modes: ListViewMode[]
}

export const ISSUE_COLUMN_METAS: IssueColumnMeta[] = [
  { key: 'issueNo', label: '编号', modes: ALL_VIEW_MODES },
  { key: 'severity', label: '重要度', modes: ALL_VIEW_MODES },
  { key: 'priority', label: '紧急度', modes: ALL_VIEW_MODES },
  { key: 'category', label: '分类', modes: ALL_VIEW_MODES },
  { key: 'detectionPhase', label: '发现阶段', modes: ALL_VIEW_MODES },
  { key: 'function', label: '功能', modes: ALL_VIEW_MODES },
  { key: 'reporter', label: '提出人', modes: ALL_VIEW_MODES },
  { key: 'assignee', label: '责任人', modes: ALL_VIEW_MODES },
  { key: 'dueDate', label: '截止日', modes: ALL_VIEW_MODES },
  { key: 'attention', label: '关注', modes: ALL_VIEW_MODES },
  { key: 'status', label: '状态', modes: ALL_VIEW_MODES },
  { key: 'createdAt', label: '创建日期', modes: ALL_VIEW_MODES },
  { key: 'checkpoints', label: '最近点检', modes: ['timeline'] },
]

const DEFAULT_SIMPLE: IssueColumnKey[] = [
  'function', 'severity', 'priority', 'assignee', 'status', 'createdAt',
]

const DEFAULT_COMPLEX: IssueColumnKey[] = [
  'function', 'severity', 'priority', 'category', 'detectionPhase',
  'reporter', 'assignee', 'dueDate', 'attention', 'status', 'createdAt',
]

const DEFAULT_TIMELINE: IssueColumnKey[] = [
  'function', 'severity', 'priority', 'assignee', 'attention',
  'status', 'dueDate', 'checkpoints',
]

/** 列配置结构版本；v2 的跟踪视图默认用截止日替代创建日期。 */
export const ISSUE_LIST_COLUMNS_VERSION = 2

function buildDefault(mode: ListViewMode): IssueColumnItemConfig[] {
  const order = mode === 'simple' ? DEFAULT_SIMPLE
    : mode === 'complex' ? DEFAULT_COMPLEX
      : DEFAULT_TIMELINE
  const allowed = new Set(ISSUE_COLUMN_METAS.filter(m => m.modes.includes(mode)).map(m => m.key))
  return ISSUE_COLUMN_METAS
    .filter(m => m.modes.includes(mode))
    .sort((a, b) => {
      const ia = order.indexOf(a.key)
      const ib = order.indexOf(b.key)
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    .map(m => ({ key: m.key, visible: allowed.has(m.key) && order.includes(m.key) }))
}

export function defaultIssueListColumns(): IssueListColumnSettings {
  return {
    simple: buildDefault('simple'),
    complex: buildDefault('complex'),
    timeline: buildDefault('timeline'),
  }
}

export function columnLabel(key: IssueColumnKey): string {
  return ISSUE_COLUMN_METAS.find(m => m.key === key)?.label ?? key
}

export function columnsForMode(
  mode: ListViewMode,
  settings: IssueListColumnSettings,
): IssueColumnItemConfig[] {
  const raw = settings[mode]
  if (!raw?.length) return buildDefault(mode)
  const allowed = new Set(ISSUE_COLUMN_METAS.filter(m => m.modes.includes(mode)).map(m => m.key))
  const seen = new Set<IssueColumnKey>()
  const merged: IssueColumnItemConfig[] = []
  for (const item of raw) {
    if (!allowed.has(item.key) || seen.has(item.key)) continue
    seen.add(item.key)
    merged.push({ key: item.key, visible: !!item.visible })
  }
  for (const meta of ISSUE_COLUMN_METAS) {
    if (!meta.modes.includes(mode) || seen.has(meta.key)) continue
    merged.push({ key: meta.key, visible: false })
  }
  return merged
}

export function visibleColumnsForMode(
  mode: ListViewMode,
  settings: IssueListColumnSettings,
): IssueColumnKey[] {
  return columnsForMode(mode, settings)
    .filter(c => c.visible)
    .map(c => c.key)
}

export const ISSUE_COLUMN_WIDTH_DEFAULTS: Record<IssueColumnKey, number> = {
  issueNo: 145,
  severity: 75,
  priority: 75,
  category: 85,
  detectionPhase: 100,
  function: 120,
  reporter: 80,
  assignee: 80,
  dueDate: 110,
  attention: 88,
  status: 90,
  createdAt: 110,
  checkpoints: 260,
}

export const SORTABLE_ISSUE_COLUMNS = new Set<IssueColumnKey>([
  'issueNo', 'severity', 'priority', 'attention', 'dueDate', 'status', 'createdAt',
])

/** 列表默认排序：关注度降序，同档内紧急度（立即优先）。字段名 priority 保留兼容。 */
export const DEFAULT_ISSUE_SORT = 'attention:desc,priority:asc'

export function primaryIssueSort(issueSort: string): { field: string; dir: 'asc' | 'desc' } {
  const primary = issueSort.split(',')[0]?.trim() || DEFAULT_ISSUE_SORT.split(',')[0]
  const [field, dir] = primary.split(':')
  return { field, dir: dir === 'asc' ? 'asc' : 'desc' }
}

export function normalizeIssueListColumns(input: unknown): IssueListColumnSettings {
  const base = defaultIssueListColumns()
  if (!input || typeof input !== 'object') return base
  const obj = input as Partial<IssueListColumnSettings>
  return {
    simple: columnsForMode('simple', { ...base, simple: obj.simple ?? base.simple }),
    complex: columnsForMode('complex', { ...base, complex: obj.complex ?? base.complex }),
    timeline: columnsForMode('timeline', { ...base, timeline: obj.timeline ?? base.timeline }),
  }
}

/**
 * 升级旧的本地列配置。跟踪视图用于判断计划是否逾期，因此只默认展示截止日；
 * 创建日期仍保留在列设置中，用户需要审计信息时可以手动打开。
 */
export function upgradeIssueListColumns(
  input: unknown,
  fromVersion: number,
): IssueListColumnSettings {
  const normalized = normalizeIssueListColumns(input)
  if (fromVersion >= ISSUE_LIST_COLUMNS_VERSION) return normalized

  const timeline = normalized.timeline.map(item => ({ ...item }))
  const dueDate = timeline.find(item => item.key === 'dueDate')
  const createdAt = timeline.find(item => item.key === 'createdAt')
  if (dueDate) dueDate.visible = true
  if (createdAt) createdAt.visible = false

  // 截止日紧邻最近点检，避免在有限宽度里同时出现两种日期。
  if (dueDate) {
    const withoutDueDate = timeline.filter(item => item.key !== 'dueDate')
    const checkpointIndex = withoutDueDate.findIndex(item => item.key === 'checkpoints')
    withoutDueDate.splice(checkpointIndex >= 0 ? checkpointIndex : withoutDueDate.length, 0, dueDate)
    return { ...normalized, timeline: withoutDueDate }
  }

  return { ...normalized, timeline }
}
