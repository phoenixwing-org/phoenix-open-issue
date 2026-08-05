import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("oip_function")
@Index(["platform", "externalId"], { unique: true })
export class OpenIssueFunctionEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id: string;

  @Index()
  @Column({ type: "varchar", length: 120 })
  platform: string;

  @Column({ type: "varchar", length: 120 })
  externalId: string;

  @Index()
  @Column({ type: "varchar", length: 240 })
  functionName: string;

  @Column({ type: "varchar", length: 32, nullable: true })
  targetYear: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  clientGroup: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  developGroup: string | null;

  @Index()
  @Column({ type: "integer", default: 1 })
  enabled: number;

  @Column({ type: "varchar", length: 32 })
  createdAt: string;

  @Column({ type: "varchar", length: 32 })
  updatedAt: string;
}
