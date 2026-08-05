import { randomUUID } from 'node:crypto';
import { Inject, Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { CoolCommException } from '@cool-midway/core';
import { In, Repository } from 'typeorm';
import {
  normalizeCheckpointUpdateInput,
  normalizeNewCheckpointInput,
} from '../domain/checkpoint';
import { OpenIssueCheckpointEntity } from '../entity/checkpoint';
import { OpenIssueListLinkEntity } from '../entity/issue-list-link';
import { OpenIssueAccessService } from './access';

@Provide()
export class OpenIssueCheckpointService {
  @Inject()
  access: OpenIssueAccessService;

  @InjectEntityModel(OpenIssueCheckpointEntity)
  checkpointRepository: Repository<OpenIssueCheckpointEntity>;

  @InjectEntityModel(OpenIssueListLinkEntity)
  linkRepository: Repository<OpenIssueListLinkEntity>;

  private failInput(error: unknown): never {
    throw new CoolCommException(
      error instanceof Error ? error.message : '请求数据无效',
      400
    );
  }

  private async required(id: string) {
    const checkpoint = await this.checkpointRepository.findOneBy({ id });
    if (!checkpoint) throw new CoolCommException('点检项不存在', 404);
    return checkpoint;
  }

  async byIssue(issueId: string) {
    await this.access.assertIssueReadable(issueId);
    return this.checkpointRepository.find({
      where: { issueId },
      order: { checkpointDate: 'DESC', sortOrder: 'DESC' },
    });
  }

  async byList(listId: string) {
    await this.access.assertListReadable(listId);
    const issueIds = (
      await this.linkRepository.find({
        where: { listId },
        select: { issueId: true },
      })
    ).map(link => link.issueId);
    if (issueIds.length === 0) return {};
    const rows = await this.checkpointRepository.find({
      where: { issueId: In(issueIds) },
      order: { checkpointDate: 'DESC', sortOrder: 'DESC' },
    });
    return rows.reduce<Record<string, OpenIssueCheckpointEntity[]>>(
      (grouped, item) => {
        (grouped[item.issueId] ??= []).push(item);
        return grouped;
      },
      {}
    );
  }

  async create(issueId: string, value: unknown) {
    const issue = await this.access.assertIssueModifiable(issueId);
    let input;
    try {
      input = normalizeNewCheckpointInput(value);
    } catch (error) {
      this.failInput(error);
    }
    const now = new Date().toISOString();
    const maxSort = await this.checkpointRepository.maximum('sortOrder', {
      issueId,
    });
    return this.checkpointRepository.save(
      this.checkpointRepository.create({
        id: randomUUID(),
        issueId: issue.id,
        checkpointDate: input.checkpointDate,
        deadline: input.deadline,
        description: input.description,
        status: 'pending',
        responsibleUserId: input.responsibleUserId,
        sortOrder: (maxSort ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  async update(id: string, value: unknown) {
    const checkpoint = await this.required(id);
    await this.access.assertIssueModifiable(checkpoint.issueId);
    let input;
    try {
      input = normalizeCheckpointUpdateInput(value);
    } catch (error) {
      this.failInput(error);
    }
    Object.assign(checkpoint, input, { updatedAt: new Date().toISOString() });
    return this.checkpointRepository.save(checkpoint);
  }

  async delete(id: string) {
    const checkpoint = await this.required(id);
    await this.access.assertIssueModifiable(checkpoint.issueId);
    checkpoint.status = 'voided';
    checkpoint.updatedAt = new Date().toISOString();
    await this.checkpointRepository.save(checkpoint);
  }
}
