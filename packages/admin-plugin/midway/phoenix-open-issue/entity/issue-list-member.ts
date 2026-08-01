import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { IssueListMemberRole } from '../domain/issue-list';

@Entity('oip_issue_list_member')
@Index(['listId', 'userId'], { unique: true })
export class OpenIssueListMemberEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: '插件领域 ID' })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, comment: '插件列表 ID' })
  listId: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: 'Host 用户 ID' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'editor',
    comment: '列表内角色',
  })
  role: IssueListMemberRole;

  @Column({ type: 'varchar', length: 32, comment: '加入时间 ISO 字符串' })
  joinedAt: string;
}
