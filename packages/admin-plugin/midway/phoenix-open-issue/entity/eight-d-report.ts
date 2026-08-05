import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("oip_eight_d_report")
export class OpenIssueEightDReportEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id: string;

  @Index()
  @Column({ type: "varchar", length: 36, nullable: true })
  relatedIssueId: string | null;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", default: "" })
  containment: string;

  @Column({ type: "text", default: "" })
  rootCause: string;

  @Column({ type: "text", default: "" })
  correctiveAction: string;

  @Index()
  @Column({ type: "varchar", length: 64 })
  createdBy: string;

  @Column({ type: "varchar", length: 32 })
  createdAt: string;

  @Index()
  @Column({ type: "varchar", length: 32 })
  updatedAt: string;

  @Index()
  @Column({ type: "smallint", default: 0 })
  isDeleted: number;

  @Column({ type: "varchar", length: 32, nullable: true })
  deletedAt: string | null;
}
