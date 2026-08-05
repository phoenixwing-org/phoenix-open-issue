import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type OpenIssuePushTargetType = "list" | "user";
export type OpenIssuePushStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn";

@Entity("oip_push_record")
export class OpenIssuePushRecordEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id: string;

  @Index()
  @Column({ type: "varchar", length: 36 })
  fromListId: string;

  @Column({ type: "varchar", length: 12, default: "list" })
  targetType: OpenIssuePushTargetType;

  @Index()
  @Column({ type: "varchar", length: 36, nullable: true })
  toListId: string | null;

  @Index()
  @Column({ type: "varchar", length: 64, nullable: true })
  toUserId: string | null;

  @Index()
  @Column({ type: "varchar", length: 36 })
  issueId: string;

  @Index()
  @Column({ type: "varchar", length: 64 })
  pushedBy: string;

  @Index()
  @Column({ type: "varchar", length: 32 })
  pushedAt: string;

  @Index()
  @Column({ type: "varchar", length: 16, default: "pending" })
  status: OpenIssuePushStatus;

  @Column({ type: "varchar", length: 64, nullable: true })
  handledBy: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  handledAt: string | null;

  @Column({ type: "text", nullable: true })
  rejectReason: string | null;

  @Column({ type: "varchar", length: 500, default: "" })
  note: string;
}
