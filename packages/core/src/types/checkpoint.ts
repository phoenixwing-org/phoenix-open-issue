export type CheckpointStatus = 'pending' | 'done' | 'skipped' | 'voided'

export interface Checkpoint {
  id: string
  issueId: string
  checkpointDate: string
  description: string
  status: CheckpointStatus
  responsibleUserId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateCheckpointInput {
  checkpointDate: string
  description: string
  responsibleUserId?: string
}

export interface UpdateCheckpointInput {
  checkpointDate?: string
  description?: string
  status?: CheckpointStatus
  responsibleUserId?: string
}
