export type CheckpointStatus = 'pending' | 'done' | 'skipped'

export interface Checkpoint {
  id: string
  issue_id: string
  checkpoint_date: string       // 'YYYY-MM-DD'
  description: string
  status: CheckpointStatus
  responsible_user_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateCheckpointInput {
  checkpoint_date: string
  description: string
  responsible_user_id?: string
}

export interface UpdateCheckpointInput {
  checkpoint_date?: string
  description?: string
  status?: CheckpointStatus
  responsible_user_id?: string
}
