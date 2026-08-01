import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { CheckpointStatus } from '../domain/checkpoint';

@Entity('oip_checkpoint')
export class OpenIssueCheckpointEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  issueId: string;

  @Index()
  @Column({ type: 'varchar', length: 10 })
  checkpointDate: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  deadline: string | null;

  @Column({ type: 'text' })
  description: string;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: CheckpointStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  responsibleUserId: string | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 32 })
  createdAt: string;

  @Column({ type: 'varchar', length: 32 })
  updatedAt: string;
}
