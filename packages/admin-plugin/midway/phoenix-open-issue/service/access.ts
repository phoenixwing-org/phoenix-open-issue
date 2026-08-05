import { Inject, Provide } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { CoolCommException } from '@cool-midway/core';
import { In, Repository } from 'typeorm';
import { canModifyIssue } from '../domain/issue';
import { OpenIssueEntity } from '../entity/issue';
import { OpenIssueListEntity } from '../entity/issue-list';
import { OpenIssueListLinkEntity } from '../entity/issue-list-link';
import { OpenIssueListMemberEntity } from '../entity/issue-list-member';

@Provide()
export class OpenIssueAccessService {
  @Inject()
  ctx: Context;

  @InjectEntityModel(OpenIssueListEntity)
  listRepository: Repository<OpenIssueListEntity>;

  @InjectEntityModel(OpenIssueListMemberEntity)
  memberRepository: Repository<OpenIssueListMemberEntity>;

  @InjectEntityModel(OpenIssueListLinkEntity)
  linkRepository: Repository<OpenIssueListLinkEntity>;

  @InjectEntityModel(OpenIssueEntity)
  issueRepository: Repository<OpenIssueEntity>;

  actorId(): string {
    const value = this.ctx.admin?.userId;
    if (value === undefined || value === null)
      throw new CoolCommException('登录身份无效', 401);
    return String(value);
  }

  isHostRoot(): boolean {
    return this.ctx.admin?.username === 'admin';
  }

  async requiredList(id: string): Promise<OpenIssueListEntity> {
    const list = await this.listRepository.findOneBy({ id });
    if (!list || list.isDeleted === 1)
      throw new CoolCommException('列表不存在', 404);
    return list;
  }

  async roleFor(listId: string): Promise<string | null> {
    const list = await this.requiredList(listId);
    if (list.ownerId === this.actorId()) return 'owner';
    return (
      (
        await this.memberRepository.findOneBy({
          listId,
          userId: this.actorId(),
        })
      )?.role ?? null
    );
  }

  async assertListReadable(listId: string): Promise<string | null> {
    const role = await this.roleFor(listId);
    if (!this.isHostRoot() && !role)
      throw new CoolCommException('无权查看此列表', 403);
    return role;
  }

  async assertIssueCreatable(listId: string): Promise<string | null> {
    const role = await this.assertListReadable(listId);
    if (
      !this.isHostRoot() &&
      !['owner', 'admin', 'editor', 'reporter'].includes(role ?? '')
    ) {
      throw new CoolCommException('无权创建 Issue', 403);
    }
    return role;
  }

  async assertListModifiable(listId: string): Promise<string | null> {
    const role = await this.assertListReadable(listId);
    if (!canModifyIssue(role, this.isHostRoot()))
      throw new CoolCommException('无权修改 Issue', 403);
    return role;
  }

  async requiredIssue(id: string): Promise<OpenIssueEntity> {
    const issue = await this.issueRepository.findOneBy({ id });
    if (!issue) throw new CoolCommException('Issue 不存在', 404);
    return issue;
  }

  async assertIssueReadable(id: string): Promise<OpenIssueEntity> {
    const issue = await this.requiredIssue(id);
    if (this.isHostRoot()) return issue;
    const links = await this.linkRepository.find({ where: { issueId: id } });
    const linkedListIds = links.map(link => link.listId);
    const listIds = (
      linkedListIds.length
        ? await this.listRepository.find({
            where: { id: In(linkedListIds), isDeleted: 0 },
            select: { id: true },
          })
        : []
    ).map(list => list.id);
    if (listIds.length === 0)
      throw new CoolCommException('无权查看此 Issue', 403);
    const member = await this.memberRepository.findOne({
      where: { listId: In(listIds), userId: this.actorId() },
    });
    const owned = await this.listRepository.findOne({
      where: { id: In(listIds), ownerId: this.actorId(), isDeleted: 0 },
    });
    if (!member && !owned) throw new CoolCommException('无权查看此 Issue', 403);
    return issue;
  }

  async assertIssueModifiable(id: string): Promise<OpenIssueEntity> {
    const issue = await this.requiredIssue(id);
    await this.assertListModifiable(issue.listId);
    return issue;
  }
}
