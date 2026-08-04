import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type OpenIssueRepairLedgerStatus = 'running' | 'succeeded' | 'failed';

/**
 * Plugin-owned audit ledger for explicit maintenance repairs.
 * The plan snapshot keeps before-values required for a reviewed recovery plan;
 * it is not a replacement for a trusted Host PostgreSQL backup.
 */
@Entity('oip_repair_ledger')
export class OpenIssueRepairLedgerEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  task: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  planFingerprint: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: 'Host 用户 ID' })
  actorId: string;

  @Column({ type: 'varchar', length: 16 })
  status: OpenIssueRepairLedgerStatus;

  @Column({ type: 'jsonb' })
  planSnapshot: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  resultSnapshot: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  startedAt: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  finishedAt: string | null;
}
