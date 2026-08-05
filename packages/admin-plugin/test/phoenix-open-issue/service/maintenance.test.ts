import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenIssueMaintenanceService } from '../../../midway/phoenix-open-issue/service/maintenance';

const checkpointPlan = {
  task: 'checkpoints' as const,
  changes: [
    {
      id: 'cp-1',
      before: {
        id: 'cp-1',
        status: '',
        sortOrder: 0,
        deadline: null,
        createdAt: '2026-08-03T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
      },
      patch: { status: 'pending' as const },
    },
  ],
  withoutDeadline: 1,
};

function serviceFixture() {
  const service = new OpenIssueMaintenanceService();
  const ledger = {
    create: vi.fn(value => value),
    save: vi.fn(async value => value),
    update: vi.fn(async () => ({ affected: 1 })),
    findAndCount: vi.fn(async (): Promise<[any[], number]> => [[], 0]),
  };
  const transactionLedger = {
    update: vi.fn(async () => ({ affected: 1 })),
  };
  const manager = {
    getRepository: vi.fn(() => transactionLedger),
  };
  const transaction = vi.fn(async (_isolation, callback) => callback(manager));
  Object.assign(service, {
    access: {
      actorId: vi.fn(() => 'user-7'),
    },
    repairLedgerRepository: ledger,
    dataSource: { transaction },
  });
  vi.spyOn(service as any, 'buildPlans').mockResolvedValue([checkpointPlan]);
  return { service, ledger, transaction, transactionLedger };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Issue 维护修正执行门禁', () => {
  it('审计查询分页且不向列表暴露业务快照', async () => {
    const { service, ledger } = serviceFixture();
    ledger.findAndCount.mockResolvedValue([
      [
        {
          id: 'ledger-1',
          task: 'links',
          planFingerprint: 'a'.repeat(64),
          actorId: 'user-7',
          status: 'failed',
          error: 'x'.repeat(800),
          startedAt: '2026-08-03T00:00:00.000Z',
          finishedAt: '2026-08-03T00:01:00.000Z',
          planSnapshot: { secret: 'before rows' },
          resultSnapshot: { secret: 'inserted rows' },
        },
      ],
      1,
    ]);

    const result = await service.ledger('2', '25');

    expect(ledger.findAndCount).toHaveBeenCalledWith({
      select: {
        id: true,
        task: true,
        planFingerprint: true,
        actorId: true,
        status: true,
        error: true,
        startedAt: true,
        finishedAt: true,
      },
      order: { startedAt: 'DESC', id: 'DESC' },
      skip: 25,
      take: 25,
    });
    expect(result).toMatchObject({ page: 2, size: 25, total: 1 });
    expect(result.list[0]).toEqual({
      id: 'ledger-1',
      task: 'links',
      planFingerprint: 'a'.repeat(64),
      actorId: 'user-7',
      status: 'failed',
      error: 'x'.repeat(500),
      startedAt: '2026-08-03T00:00:00.000Z',
      finishedAt: '2026-08-03T00:01:00.000Z',
    });
    expect(result.list[0]).not.toHaveProperty('planSnapshot');
    expect(result.list[0]).not.toHaveProperty('resultSnapshot');
  });

  it('审计查询拒绝无界页大小', async () => {
    const { service, ledger } = serviceFixture();

    await expect(service.ledger(1, 101)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(ledger.findAndCount).not.toHaveBeenCalled();
  });

  it('过期数据指纹在写业务表前失败，并保留完整失败 ledger', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T00:05:00.000Z'));
    const { service, ledger, transaction } = serviceFixture();

    await expect(
      service.run('checkpoints', {
        fingerprint: '0'.repeat(64),
        generatedAt: '2026-08-03T00:00:00.000Z',
        confirmed: true,
      })
    ).rejects.toThrow('数据已变化');

    expect(transaction).not.toHaveBeenCalled();
    expect(ledger.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'running',
        planSnapshot: expect.objectContaining({
          expectedFingerprint: '0'.repeat(64),
          plans: [checkpointPlan],
        }),
      })
    );
    expect(ledger.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'failed', error: expect.stringContaining('数据已变化') })
    );
  });

  it('确认计划只在 SERIALIZABLE 事务中执行，并在提交后完成 ledger', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T00:00:00.000Z'));
    const { service, transaction, transactionLedger } = serviceFixture();
    const executePlans = vi.spyOn(service as any, 'executePlans').mockResolvedValue({
      results: [
        {
          task: 'checkpoints',
          message: '已修正 1 条点检记录',
          details: [],
          fixed: 1,
          ledgerId: 'ledger',
        },
      ],
      resultSnapshot: {},
    });
    const plan = await service.plan('checkpoints');

    const result = await service.run('checkpoints', {
      fingerprint: plan.fingerprint,
      generatedAt: plan.generatedAt,
      confirmed: true,
    });

    expect(transaction).toHaveBeenCalledWith('SERIALIZABLE', expect.any(Function));
    expect(executePlans).toHaveBeenCalledTimes(1);
    expect(result[0].fixed).toBe(1);
    expect(transactionLedger.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'succeeded', resultSnapshot: {} })
    );
  });
});
