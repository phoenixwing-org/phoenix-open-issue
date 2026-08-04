import { describe, expect, it, vi } from 'vitest';
import { OpenIssueAccessService } from '../../../midway/phoenix-open-issue/service/access';

type Actor = { userId?: string | number; username?: string };

function accessFixture(actor: Actor = { userId: 'user-1', username: 'member' }) {
  const service = new OpenIssueAccessService();
  const lists = new Map<string, any>([
    ['owned', { id: 'owned', ownerId: 'user-1', isDeleted: 0 }],
    ['shared', { id: 'shared', ownerId: 'owner-2', isDeleted: 0 }],
    ['origin', { id: 'origin', ownerId: 'owner-3', isDeleted: 0 }],
  ]);
  const issues = new Map<string, any>([
    ['issue-1', { id: 'issue-1', listId: 'origin' }],
  ]);
  const membership = new Map<string, string>();
  const linkedListIds = new Map<string, string[]>([['issue-1', ['shared']]]);

  const listRepository = {
    findOneBy: vi.fn(async ({ id }: { id: string }) => lists.get(id)),
    find: vi.fn(async ({ where }: any) => {
      const ids = where.id.value as string[];
      return ids.map(id => lists.get(id)).filter(list => list?.isDeleted === 0);
    }),
    findOne: vi.fn(async ({ where }: any) => {
      const ids = where.id.value as string[];
      return ids.map(id => lists.get(id)).find(list =>
        list?.ownerId === String(actor.userId) && list?.isDeleted === 0,
      );
    }),
  };
  const memberRepository = {
    findOneBy: vi.fn(async ({ listId, userId }: { listId: string; userId: string }) => {
      const role = membership.get(`${listId}:${userId}`);
      return role ? { listId, userId, role } : undefined;
    }),
    findOne: vi.fn(async ({ where }: any) => {
      const ids = where.listId.value as string[];
      const userId = String(where.userId);
      const listId = ids.find(id => membership.has(`${id}:${userId}`));
      return listId ? { listId, userId, role: membership.get(`${listId}:${userId}`) } : undefined;
    }),
  };
  const linkRepository = {
    find: vi.fn(async ({ where }: any) =>
      (linkedListIds.get(String(where.issueId)) ?? []).map(listId => ({ listId })),
    ),
  };
  const issueRepository = {
    findOneBy: vi.fn(async ({ id }: { id: string }) => issues.get(id)),
  };

  Object.assign(service, {
    ctx: { admin: actor },
    listRepository,
    memberRepository,
    linkRepository,
    issueRepository,
  });

  return {
    service,
    lists,
    issues,
    membership,
    linkedListIds,
    repositories: { listRepository, memberRepository, linkRepository, issueRepository },
  };
}

describe('Issue Midway 资源权限边界', () => {
  it('匿名上下文在访问仓储前以 401 fail closed', async () => {
    const { service, repositories } = accessFixture({});

    expect(() => service.actorId()).toThrow('登录身份无效');
    try {
      service.actorId();
    } catch (error: any) {
      expect(error.statusCode).toBe(401);
    }
    expect(repositories.listRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('只给普通用户开放其拥有或加入的列表', async () => {
    const { service, membership } = accessFixture();

    await expect(service.assertListReadable('owned')).resolves.toBe('owner');
    membership.set('shared:user-1', 'viewer');
    await expect(service.assertListReadable('shared')).resolves.toBe('viewer');
    membership.delete('shared:user-1');
    await expect(service.assertListReadable('shared')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('保留 reporter 创建权，但写入仅允许 owner/admin/editor', async () => {
    const { service, membership } = accessFixture();

    membership.set('shared:user-1', 'reporter');
    await expect(service.assertIssueCreatable('shared')).resolves.toBe('reporter');
    await expect(service.assertListModifiable('shared')).rejects.toMatchObject({ statusCode: 403 });

    membership.set('shared:user-1', 'editor');
    await expect(service.assertListModifiable('shared')).resolves.toBe('editor');

    membership.set('shared:user-1', 'viewer');
    await expect(service.assertIssueCreatable('shared')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('Issue 只对至少一个有效关联列表的成员或负责人可读', async () => {
    const { service, membership, lists } = accessFixture();

    membership.set('shared:user-1', 'viewer');
    await expect(service.assertIssueReadable('issue-1')).resolves.toMatchObject({ id: 'issue-1' });

    membership.delete('shared:user-1');
    await expect(service.assertIssueReadable('issue-1')).rejects.toMatchObject({ statusCode: 403 });

    lists.get('shared').ownerId = 'user-1';
    await expect(service.assertIssueReadable('issue-1')).resolves.toMatchObject({ id: 'issue-1' });

    lists.get('shared').isDeleted = 1;
    await expect(service.assertIssueReadable('issue-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('Issue 修改继续锚定来源列表角色，不因其他关联列表可读而提权', async () => {
    const { service, membership } = accessFixture();

    membership.set('shared:user-1', 'editor');
    membership.set('origin:user-1', 'viewer');
    await expect(service.assertIssueModifiable('issue-1')).rejects.toMatchObject({ statusCode: 403 });

    membership.set('origin:user-1', 'editor');
    await expect(service.assertIssueModifiable('issue-1')).resolves.toMatchObject({ id: 'issue-1' });
  });

  it('Cool root 只绕过资源角色，不绕过不存在的业务对象', async () => {
    const { service } = accessFixture({ userId: 1, username: 'admin' });

    expect(service.actorId()).toBe('1');
    await expect(service.assertListReadable('shared')).resolves.toBeNull();
    await expect(service.assertIssueReadable('issue-1')).resolves.toMatchObject({ id: 'issue-1' });
    await expect(service.assertIssueReadable('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
