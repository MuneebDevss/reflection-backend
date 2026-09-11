import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from '../../tasks/tasks.service';
import { ScheduleMcpTools } from './schedule.mcp-tools';

type McpToolResult = { content: { type: string; text: string }[]; isError?: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRequest(mcpUserId: string | undefined = 'user-uuid-123') {
  return { mcpUserId } as any;
}

function mockContext() {
  return {} as any;
}

const MOCK_SCHEDULE_SUMMARY = [
  { date: '2026-06-27', totalScheduledMinutes: 120, dailyCapacityMinutes: 480 },
  { date: '2026-06-28', totalScheduledMinutes: 60, dailyCapacityMinutes: 480 },
];

const MOCK_BULK_SHIFT_RESULT = {
  shiftedCount: 3,
  newDate: new Date('2026-06-30'),
};

// ── Mock Service ──────────────────────────────────────────────────────────────

const mockTasksService = {
  getCapacitySummary: jest.fn().mockResolvedValue(MOCK_SCHEDULE_SUMMARY),
  bulkShiftTasks: jest.fn().mockResolvedValue(MOCK_BULK_SHIFT_RESULT),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ScheduleMcpTools (unit)', () => {
  let tool: ScheduleMcpTools;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleMcpTools,
        { provide: TasksService, useValue: mockTasksService },
      ],
    }).compile();

    tool = module.get<ScheduleMcpTools>(ScheduleMcpTools);
    jest.clearAllMocks();
  });

  // ── getUserSchedule ────────────────────────────────────────────────────────

  describe('getUserSchedule', () => {
    const validInput = {
      start_date: '2026-06-27',
      end_date: '2026-06-28',
    };

    it('should call getCapacitySummary with parsed Date objects', async () => {
      await tool.getUserSchedule(validInput, mockContext(), mockRequest());

      expect(mockTasksService.getCapacitySummary).toHaveBeenCalledWith(
        'user-uuid-123',
        {
          startDate: new Date('2026-06-27'),
          endDate: new Date('2026-06-28'),
        },
      );
    });

    it('should return schedule summary as JSON', async () => {
      const result = await tool.getUserSchedule(validInput, mockContext(), mockRequest());

      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].date).toBe('2026-06-27');
      expect(parsed[0].totalScheduledMinutes).toBe(120);
      expect(parsed[0].dailyCapacityMinutes).toBe(480);
    });

    it('should return an auth error when mcpUserId is missing', async () => {
      const result = await tool.getUserSchedule(validInput, mockContext(), mockRequest(undefined)) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication credentials expired');
    });

    it('should return an error when the service throws', async () => {
      mockTasksService.getCapacitySummary.mockRejectedValueOnce(new Error('User not found'));

      const result = await tool.getUserSchedule(validInput, mockContext(), mockRequest()) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('User not found');
    });

    it('should pass Date objects even for same-day range', async () => {
      const singleDayInput = { start_date: '2026-06-27', end_date: '2026-06-27' };
      await tool.getUserSchedule(singleDayInput, mockContext(), mockRequest());

      expect(mockTasksService.getCapacitySummary).toHaveBeenCalledWith(
        'user-uuid-123',
        {
          startDate: new Date('2026-06-27'),
          endDate: new Date('2026-06-27'),
        },
      );
    });
  });

  // ── bulkShiftTasks ─────────────────────────────────────────────────────────

  describe('bulkShiftTasks', () => {
    const validInput = {
      start_date: '2026-06-27',
      end_date: '2026-06-29',
      shift_to_date: '2026-06-30',
    };

    it('should call bulkShiftTasks with parsed Date objects', async () => {
      await tool.bulkShiftTasks(validInput, mockContext(), mockRequest());

      expect(mockTasksService.bulkShiftTasks).toHaveBeenCalledWith(
        'user-uuid-123',
        {
          startDate: new Date('2026-06-27'),
          endDate: new Date('2026-06-29'),
          shiftToDate: new Date('2026-06-30'),
        },
      );
    });

    it('should return the bulk shift result as JSON', async () => {
      const result = await tool.bulkShiftTasks(validInput, mockContext(), mockRequest());

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.shiftedCount).toBe(3);
    });

    it('should return an auth error when mcpUserId is missing', async () => {
      const result = await tool.bulkShiftTasks(validInput, mockContext(), mockRequest(undefined)) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication credentials expired');
    });

    it('should return an error when the service throws', async () => {
      mockTasksService.bulkShiftTasks.mockRejectedValueOnce(new Error('Invalid date format.'));

      const result = await tool.bulkShiftTasks(validInput, mockContext(), mockRequest()) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid date format.');
    });

    it('should handle zero tasks shifted gracefully', async () => {
      mockTasksService.bulkShiftTasks.mockResolvedValueOnce({ shiftedCount: 0, newDate: new Date('2026-06-30') });

      const result = await tool.bulkShiftTasks(validInput, mockContext(), mockRequest());

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.shiftedCount).toBe(0);
    });
  });
});