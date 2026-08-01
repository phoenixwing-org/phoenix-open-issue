import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('oip_issue_list_link')
@Index(['issueId', 'listId'], { unique: true })
export class OpenIssueListLinkEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  issueId: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  listId: string;

  @Column({ type: 'smallint', default: 3 })
  attentionLevel: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  attentionUpdatedAt: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  attentionUpdatedBy: string | null;

  @Column({ type: 'varchar', length: 32 })
  linkedAt: string;

  @Column({ type: 'varchar', length: 64 })
  linkedBy: string;
}
