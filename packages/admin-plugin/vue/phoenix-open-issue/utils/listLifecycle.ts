import { ElMessageBox } from 'element-plus'

export type ListLifecycleFilter = 'active' | 'archived'
export type ListLifecycleKey = ListLifecycleFilter | 'deleted'

export interface ListLifecycleLike {
  archived?: number | boolean
  isDeleted?: number | boolean
}

export function listLifecycleStatus(row: ListLifecycleLike) {
  if (row.isDeleted) return { key: 'deleted' as const, label: '已删除', type: 'danger' as const }
  if (row.archived) return { key: 'archived' as const, label: '已归档', type: 'info' as const }
  return { key: 'active' as const, label: '正常', type: 'success' as const }
}

export function filterListsByLifecycle<T extends ListLifecycleLike>(
  lists: T[],
  filter: ListLifecycleFilter,
): T[] {
  return lists.filter(list => listLifecycleStatus(list).key === filter)
}

export function listArchiveConfirmation(name: string, archived: boolean) {
  return {
    message: archived
      ? `确定归档列表「${name}」？归档后会从正常视图隐藏，可在「已归档」视图中取消归档。`
      : `确定取消归档列表「${name}」？恢复后会回到正常视图。`,
    title: archived ? '确认归档' : '确认取消归档',
    options: {
      confirmButtonText: archived ? '归档' : '取消归档',
      cancelButtonText: '返回',
      type: archived ? 'warning' as const : 'info' as const,
    },
  }
}

export async function confirmListArchive(name: string, archived: boolean): Promise<boolean> {
  const confirmation = listArchiveConfirmation(name, archived)
  try {
    await ElMessageBox.confirm(
      confirmation.message,
      confirmation.title,
      confirmation.options,
    )
    return true
  } catch {
    return false
  }
}
