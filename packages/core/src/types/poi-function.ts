// ============================================================
// poiFunctions — 跨平台功能条目表（phoenix open issue functions）
// ============================================================

export interface PoiFunction {
  id: string
  platform: string
  externalId: string
  functionName: string
  targetYear: string | null
  clientGroup: string | null
  developGroup: string | null
  enabled: number
  createdAt: string
  updatedAt: string
}

export interface CreatePoiFunctionInput {
  platform: string
  externalId: string
  functionName: string
  targetYear?: string
  clientGroup?: string
  developGroup?: string
}

export interface UpdatePoiFunctionInput {
  platform?: string
  externalId?: string
  functionName?: string
  targetYear?: string
  clientGroup?: string
  developGroup?: string
}
