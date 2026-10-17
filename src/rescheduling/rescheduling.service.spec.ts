import { DateTimeService } from '@common/date-time/date-time.service';
import { ReschedulingService } from './rescheduling.service';
import { RescheduleStrategy } from './reschedule-strategy.enum';

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

const task = (id: string, scheduledDate: string, overrides: Record<string, unknown> = {}) => ({
  id,
  scheduledDate: day(scheduledDate),
  estimatedMinutes: 60,
  basePriority: 'medium',
  bumpCount: 0,
  ...overrides,
});

describe('ReschedulingService', () => {
  let service: ReschedulingService;
  let prisma: any;
  let updates: any[];

  beforeEach(() => {
    updates = [];
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ dailyCapacityMinutes: 120, timezone: 'UTC' }),
      },
      task: {
        findMany: jest.fn(),
        update: jest.fn((update) => {
          updates.push(update);
          return Promise.resolve(update);
        }),
      },
      rescheduleLog: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    service = new ReschedulingService(new DateTimeService(), prisma);
  });

  const setTasks = (rows: any[]) => {
    prisma.task.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((row) => (row.status ?? 'pending') === where.status),
    );
  };

  it('returns without changing anything when there are no overdue pending tasks', async () => {
    setTasks([
      task('future', '2026-10-20'),
      task('completed', '2026-10-10', { status: 'completed' }),
    ]);

    const result = await service.rescheduleTasks('user', day('2026-10-17'), RescheduleStrategy.CDU);

    expect(result).toEqual({ success: false, message: 'No overdue pending tasks to process.' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('CDU keeps same-date tasks together and compresses all date gaps', async () => {
    setTasks([
      task('a', '2026-10-10'),
      task('b', '2026-10-10', { basePriority: 'high' }),
      task('c', '2026-10-13'),
      task('d', '2026-10-17'),
      task('e', '2026-10-24'),
    ]);

    const result = await service.rescheduleTasks('user', day('2026-10-17'), RescheduleStrategy.CDU);

    expect(result).toMatchObject({ success: true, strategy: RescheduleStrategy.CDU, seatedCount: 5 });
    expect(updates.map((update) => [update.where.id, update.data.scheduledDate.toISOString().slice(0, 10)])).toEqual([
      ['a', '2026-10-17'],
      ['b', '2026-10-17'],
      ['c', '2026-10-18'],
      ['d', '2026-10-19'],
      ['e', '2026-10-20'],
    ]);
  });

  it('CDU handles a single overdue date group', async () => {
    setTasks([
      task('a', '2026-10-16'),
      task('b', '2026-10-16'),
    ]);

    await service.rescheduleTasks('user', day('2026-10-17'), RescheduleStrategy.CDU);

    expect(updates).toHaveLength(2);
    expect(updates.every((update) => update.data.scheduledDate.getTime() === day('2026-10-17').getTime())).toBe(true);
  });

  it('HPF orders high priority first and older date first for equal priority', async () => {
    setTasks([
      task('high-new', '2026-10-12', { basePriority: 'high' }),
      task('high-old', '2026-10-10', { basePriority: 'high' }),
      task('medium', '2026-10-08', { basePriority: 'medium' }),
      task('low', '2026-10-05', { basePriority: 'low' }),
    ]);

    await service.rescheduleTasks('user', day('2026-10-17'), RescheduleStrategy.HPF);

    expect(updates.map((update) => update.where.id)).toEqual(['high-old', 'high-new', 'medium', 'low']);
  });

  it('FG preserves existing future dates while filling available capacity', async () => {
    setTasks([
      task('oldest', '2026-10-10', { basePriority: 'low' }),
      task('newer', '2026-10-12', { basePriority: 'high' }),
      task('existing-c', '2026-10-17'),
      task('existing-d', '2026-10-19'),
      task('existing-e', '2026-10-22'),
    ]);

    await service.rescheduleTasks('user', day('2026-10-17'), RescheduleStrategy.FG);

    expect(updates.map((update) => [update.where.id, update.data.scheduledDate.toISOString().slice(0, 10)])).toEqual([
      ['oldest', '2026-10-17'],
      ['newer', '2026-10-18'],
    ]);
  });

  it('always queries only pending tasks for rescheduling', async () => {
    setTasks([]);
    await service.rescheduleTasks('user', day('2026-10-17'), RescheduleStrategy.CDU);

    expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user', status: 'pending' },
    }));
  });
});
