import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('oip_issue_list')
export class OpenIssueListEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: '插件领域 ID' })
  id: string;

  @Column({ type: 'varchar', length: 120, comment: '列表名称' })
  name: string;

  @Column({ type: 'text', default: '', comment: '列表描述' })
  description: string;

  @Index()
  @Column({ type: 'varchar', length: 80, comment: 'Host 字典中的列表类型值' })
  listType: string;

  @Index()
  @Column({ type: 'varchar', length: 64, comment: 'Host 用户 ID' })
  ownerId: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'Host 部门 ID',
  })
  orgUnitId: string | null;

  @Index()
  @Column({ type: 'smallint', default: 0, comment: '是否归档' })
  archived: number;

  @Index()
  @Column({ type: 'smallint', default: 0, comment: '是否软删除' })
  isDeleted: number;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '删除时间 ISO 字符串',
  })
  deletedAt: string | null;

  @Column({ type: 'varchar', length: 32, comment: '创建时间 ISO 字符串' })
  createdAt: string;

  @Index()
  @Column({ type: 'varchar', length: 32, comment: '更新时间 ISO 字符串' })
  updatedAt: string;
}
