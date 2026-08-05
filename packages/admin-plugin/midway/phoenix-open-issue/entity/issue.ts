import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
  IssueCategory,
  IssueDetectionPhase,
  IssuePriority,
  IssueSeverity,
  IssueStatus,
} from "../domain/issue";

@Entity("oip_issue")
export class OpenIssueEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id: string;

  @Index()
  @Column({ type: "varchar", length: 36, comment: "Issue 原始归属列表" })
  listId: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 40 })
  issueNo: string;

  @Column({ type: "varchar", length: 240 })
  title: string;

  @Column({ type: "text", default: "" })
  description: string;

  @Index()
  @Column({ type: "varchar", length: 20, default: "open" })
  status: IssueStatus;

  @Column({ type: "varchar", length: 32, nullable: true })
  closeReason: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  closedBy: string | null;

  @Column({ type: "varchar", length: 20, default: "medium" })
  priority: IssuePriority;

  @Column({ type: "varchar", length: 20, default: "minor" })
  severity: IssueSeverity;

  @Column({ type: "varchar", length: 24, nullable: true })
  category: IssueCategory | null;

  @Column({ type: "varchar", length: 24, nullable: true })
  detectionPhase: IssueDetectionPhase | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  reporterId: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  assigneeId: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  dueDate: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  completedAt: string | null;

  @Column({ type: "integer", default: 0 })
  sortOrder: number;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  extensions: Record<string, unknown>;

  @Column({ type: "integer", default: 1 })
  listCount: number;

  @Column({ type: "varchar", length: 64 })
  createdBy: string;

  @Column({ type: "varchar", length: 32 })
  createdAt: string;

  @Index()
  @Column({ type: "varchar", length: 32 })
  updatedAt: string;

  @Index()
  @Column({ type: "varchar", length: 36, nullable: true })
  functionId: string | null;
}
