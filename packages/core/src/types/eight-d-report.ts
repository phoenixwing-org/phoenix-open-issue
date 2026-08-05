export interface EightDReport {
  id: string
  relatedIssueId: string | null
  title: string
  containment: string
  rootCause: string
  correctiveAction: string
  createdBy: string
  createdAt: string
  updatedAt: string
  isDeleted: number
  deletedAt: string | null
}

export interface EightDReportInput {
  relatedIssueId?: string | null
  title: string
  containment?: string
  rootCause?: string
  correctiveAction?: string
}

export interface EightDReportIssueOption {
  id: string
  issueNo: string
  title: string
  listName: string
}
