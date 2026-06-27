/**
 * Integration Tests — MCP Tools
 * ─────────────────────────────
 * These tests spin up a real NestJS module with a mocked PrismaService and
 * DateTimeService so the full service layer runs but no actual DB is required.
 *
 * Run with:
 *   npx jest --testPathPattern=mcp.integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DateTimeService } from '@common/date-time/date-time.service';
import { TasksMcpTools } from './tools/tasks.mcp-tools';
import { ScheduleMcpTools } from './tools/schedule.mcp-tools';
import { TasksService } from '../tasks/tasks.service';
import { PrismaService } from '../prisma/prisma.service';

type McpToolResult = { content: { type: string; text: string }[]; isError?: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRequest(mcpUserId = 'integration-user-uuid') {
  return { mcpUserId } as any;
}

function mockContext() {
  return {} as any;
}

// ── Shared Fixtures ───────────────────────────────────────────────────────────

const TASK_FIXTURE = {
  id: 'task-integration-uuid',
  userId: 'integration-user-uuid',
  title: 'Integration Test Task',
  description: null,
  scheduledDate: new Date('2026-06-27T00:00:00.000Z'),
  estimatedMinutes: 30,
  basePriority: 'medium',
  status: 'pending',
  compositeScore: 0,
  planId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Prisma Mock ───────────────────────────────────────────────────────────────
// Mocks only the methods TasksService actually calls, leaving the rest untouched.

const mockPrisma = {
  task: {
    findMany: jest.fn().mockResolvedValue([TASK_FIXTURE]),
    create: jest.fn().mockResolvedValue(TASK_FIXTURE),
    update: jest.fn().mockResolvedValue({ ...TASK_FIXTURE, title: 'Updated via integration' }),
    delete: jest.fn().mockResolvedValue(TASK_FIXTURE),
    updateMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ dailyCapacityMinutes: 480 }),
  },
  rescheduleLog: {
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  $transaction: jest.fn().mockImplementation((ops: Promise<any>[]) => Promise.all(ops)),
};

// ── DateTimeService Mock ──────────────────────────────────────────────────────

const mockDateTimeService = {
  startOfDay: jest.fn().mockImplementation((date: Date) => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }),
  endOfDay: jest.fn().mockImplementation((date: Date) => {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }),
  now: jest.fn().mockReturnValue(new Date('2026-06-27T12:00:00.000Z')),
};

// ── Module Setup ──────────────────────────────────────────────────────────────

describe('MCP Tools — Integration', () => {
  let tasksTool: TasksMcpTools;
  let scheduleTool: ScheduleMcpTools;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksMcpTools,
        ScheduleMcpTools,
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DateTimeService, useValue: mockDateTimeService },
      ],
    }).compile();

    tasksTool = module.get<TasksMcpTools>(TasksMcpTools);
    scheduleTool = module.get<ScheduleMcpTools>(ScheduleMcpTools);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default resolved values after clearAllMocks
    mockPrisma.task.findMany.mockResolvedValue([TASK_FIXTURE]);
    mockPrisma.task.create.mockResolvedValue(TASK_FIXTURE);
    mockPrisma.task.update.mockResolvedValue({ ...TASK_FIXTURE, title: 'Updated via integration' });
    mockPrisma.task.delete.mockResolvedValue(TASK_FIXTURE);
    mockPrisma.task.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.user.findUnique.mockResolvedValue({ dailyCapacityMinutes: 480 });
    mockPrisma.rescheduleLog.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.$transaction.mockImplementation((ops: Promise<any>[]) => Promise.all(ops));
  });

  // ── TasksMcpTools ─────────────────────────────────────────────────────────

  describe('TasksMcpTools', () => {
    describe('createTask', () => {
      it('should flow through the full service layer and call prisma.task.create', async () => {
        const result = await tasksTool.createTask(
          {
            title: 'Integration Test Task',
            estimated_minutes: 30,
            scheduled_date: '2026-06-27',
            base_priority: 'medium',
          },
          mockContext(),
          mockRequest(),
        );

        expect(mockPrisma.task.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.task.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'integration-user-uuid',
              title: 'Integration Test Task',
              estimatedMinutes: 30,
            }),
          }),
        );
        expect(result.content[0].text).toContain('Successfully created task');
      });

      it('should pass a UTC-normalized date to Prisma via DateTimeService.startOfDay', async () => {
        await tasksTool.createTask(
          {
            title: 'Date normalization check',
            estimated_minutes: 15,
            scheduled_date: '2026-06-27',
            base_priority: 'low',
          },
          mockContext(),
          mockRequest(),
        );

        expect(mockDateTimeService.startOfDay).toHaveBeenCalledWith(new Date('2026-06-27'));

        const prismaCall = mockPrisma.task.create.mock.calls[0][0];
        const scheduledDate: Date = prismaCall.data.scheduledDate;
        expect(scheduledDate.getUTCHours()).toBe(0);
        expect(scheduledDate.getUTCMinutes()).toBe(0);
        expect(scheduledDate.getUTCSeconds()).toBe(0);
      });
    });

    describe('getTasks', () => {
      it('should flow through service and call prisma.task.findMany with date boundaries', async () => {
        const result = await tasksTool.getTasks(
          { start_date: '2026-06-27', end_date: '2026-06-27' },
          mockContext(),
          mockRequest(),
        );

        expect(mockPrisma.task.findMany).toHaveBeenCalledTimes(1);
        const whereClause = mockPrisma.task.findMany.mock.calls[0][0].where;
        expect(whereClause.userId).toBe('integration-user-uuid');
        expect(whereClause.scheduledDate.gte).toBeInstanceOf(Date);
        expect(whereClause.scheduledDate.lte).toBeInstanceOf(Date);

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].title).toBe('Integration Test Task');
      });

      it('should apply status filter when provided', async () => {
        await tasksTool.getTasks(
          { start_date: '2026-06-27', end_date: '2026-06-27', status: 'completed' },
          mockContext(),
          mockRequest(),
        );

        const whereClause = mockPrisma.task.findMany.mock.calls[0][0].where;
        expect(whereClause.status).toBe('completed');
      });
    });

    describe('updateTask', () => {
      it('should call prisma.task.update with correct ID and parsed date', async () => {
        const result = await tasksTool.updateTask(
          {
            task_id: 'task-integration-uuid',
            title: 'Updated via integration',
            scheduled_date: '2026-06-28',
          },
          mockContext(),
          mockRequest(),
        );

        expect(mockPrisma.task.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'task-integration-uuid' },
            data: expect.objectContaining({
              title: 'Updated via integration',
              scheduledDate: new Date('2026-06-28'),
            }),
          }),
        );
        expect(result.content[0].text).toContain('Updated via integration');
      });
    });

    describe('deleteTask', () => {
      it('should call prisma.task.delete with the correct task ID', async () => {
        const result = await tasksTool.deleteTask(
          { task_id: 'task-integration-uuid' },
          mockContext(),
          mockRequest(),
        );

        expect(mockPrisma.task.delete).toHaveBeenCalledWith({
          where: { id: 'task-integration-uuid' },
        });
        expect(result.content[0].text).toContain('permanently erased');
      });

      it('should return an error when the task does not exist (P2025)', async () => {
        const err: any = new Error('Record not found');
        err.code = 'P2025';
        mockPrisma.task.delete.mockRejectedValueOnce(err);

        const result = await tasksTool.deleteTask(
          { task_id: 'nonexistent-uuid' },
          mockContext(),
          mockRequest(),
        ) as McpToolResult;

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Target item not found');
      });
    });
  });

  // ── ScheduleMcpTools ──────────────────────────────────────────────────────

  describe('ScheduleMcpTools', () => {
    describe('getUserSchedule', () => {
      it('should flow through service and return a capacity summary', async () => {
        const result = await scheduleTool.getUserSchedule(
          { start_date: '2026-06-27', end_date: '2026-06-28' },
          mockContext(),
          mockRequest(),
        );

        // Prisma calls: task.findMany + user.findUnique
        expect(mockPrisma.task.findMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'integration-user-uuid' },
          select: { dailyCapacityMinutes: true },
        });

        const parsed = JSON.parse(result.content[0].text);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed[0]).toHaveProperty('date');
        expect(parsed[0]).toHaveProperty('totalScheduledMinutes');
        expect(parsed[0]).toHaveProperty('dailyCapacityMinutes', 480);
      });

      it('should return not-found error when user does not exist', async () => {
        mockPrisma.user.findUnique.mockResolvedValueOnce(null);

        const result = await scheduleTool.getUserSchedule(
          { start_date: '2026-06-27', end_date: '2026-06-28' },
          mockContext(),
          mockRequest(),
        ) as McpToolResult;

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('No records matching');
      });
    });

    describe('bulkShiftTasks', () => {
      it('should call prisma.$transaction with updateMany and createMany', async () => {
        mockPrisma.task.findMany.mockResolvedValueOnce([
          { id: 'task-1', scheduledDate: new Date('2026-06-27') },
          { id: 'task-2', scheduledDate: new Date('2026-06-28') },
        ]);

        const result = await scheduleTool.bulkShiftTasks(
          {
            start_date: '2026-06-27',
            end_date: '2026-06-29',
            shift_to_date: '2026-06-30',
          },
          mockContext(),
          mockRequest(),
        );

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.task.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: { in: ['task-1', 'task-2'] } },
          }),
        );
        expect(mockPrisma.rescheduleLog.createMany).toHaveBeenCalledTimes(1);

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.shiftedCount).toBe(2);
      });

      it('should return shiftedCount of 0 when no pending tasks exist in range', async () => {
        mockPrisma.task.findMany.mockResolvedValueOnce([]);

        const result = await scheduleTool.bulkShiftTasks(
          {
            start_date: '2026-06-27',
            end_date: '2026-06-29',
            shift_to_date: '2026-06-30',
          },
          mockContext(),
          mockRequest(),
        );

        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.shiftedCount).toBe(0);
      });

      it('should return an auth error when mcpUserId is missing', async () => {
        const result = await scheduleTool.bulkShiftTasks(
          {
            start_date: '2026-06-27',
            end_date: '2026-06-29',
            shift_to_date: '2026-06-30',
          },
          mockContext(),
          mockRequest(undefined),
        ) as McpToolResult;

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Authentication credentials expired');
      });
    });
  });
});