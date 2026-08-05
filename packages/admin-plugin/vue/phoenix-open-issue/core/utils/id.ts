/** 架构统一 ID 分配 —— 所有表的新增记录均通过此函数获取 ID */
export function generateId(): string {
  return crypto.randomUUID()
}
