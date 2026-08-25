export type CheckpointStatus = 'pending' | 'done' | 'skipped' | 'voided'

export interface Checkpoint {
  id: string
  issueId: string
  checkpointDate: string
  deadline: string | null
  description: string
  status: CheckpointStatus
  responsibleUserId: string | null
  responsibleUserName?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateCheckpointInput {
  checkpointDate: string
  deadline?: string | null
  description: string
  responsibleUserId?: string
}

export interface UpdateCheckpointInput {
  checkpointDate?: string
  deadline?: string | null
  description?: string
  status?: CheckpointStatus
  responsibleUserId?: string
}
