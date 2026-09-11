import { Test, TestingModule } from '@nestjs/testing';

import { TasksService } from '../../tasks/tasks.service';
import { TasksMcpTools } from './tasks.mcp-tools';

type McpToolResult = { content: { type: string; text: string }[]; isError?: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRequest(mcpUserId: string | undefined = 'user-uuid-123') {
  return { mcpUserId } as any;
}

function mockContext() {
  return {} as any;
}

const MOCK_TASK = {
  id: 'task-uuid-456',
  userId: 'user-uuid-123',
  title: 'Fix Stratos MCP',
  description: 'Test all endpoints',
  scheduledDate: new Date('2026-06-27'),
  estimatedMinutes: 60,
  basePriority: 'high',
  status: 'pending',
  compositeScore: 0,
  planId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Mock Service ──────────────────────────────────────────────────────────────

const mockTasksService = {
  createTask: jest.fn().mockResolvedValue(MOCK_TASK),
  getTasks: jest.fn().mockResolvedValue([MOCK_TASK]),
  updateTask: jest.fn().mockResolvedValue({ ...MOCK_TASK, title: 'Updated Title' }),
  deleteTask: jest.fn().mockResolvedValue(MOCK_TASK),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TasksMcpTools (unit)', () => {
  let tool: TasksMcpTools;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksMcpTools,
        { provide: TasksService, useValue: mockTasksService },
      ],
    }).compile();

    tool = module.get<TasksMcpTools>(TasksMcpTools);
    jest.clearAllMocks();
  });

  // ── createTask ─────────────────────────────────────────────────────────────

  describe('createTask', () => {
    const validInput = {
      title: 'Fix Stratos MCP',
      description: 'Test all endpoints',
      estimated_minutes: 60,
      scheduled_date: '2026-06-27',
      base_priority: 'high',
    };

    it('should call tasksService.createTask with a parsed Date object', async () => {
      await tool.createTask(validInput, mockContext(), mockRequest());

      expect(mockTasksService.createTask).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.objectContaining({
          scheduleDate: new Date('2026-06-27'),
        }),
      );
    });

    it('should return a success message on creation', async () => {
      const result = await tool.createTask(validInput, mockContext(), mockRequest());

      expect(result.content[0].text).toContain('Successfully created task');
      expect(result.content[0].text).toContain('Fix Stratos MCP');
    });

    it('should return an auth error when mcpUserId is missing', async () => {
      const result = await tool.createTask(validInput, mockContext(), mockRequest(undefined)) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication expired');
    });

    it('should return an error when the service throws', async () => {
      mockTasksService.createTask.mockRejectedValueOnce(new Error('DB connection lost'));

      const result = await tool.createTask(validInput, mockContext(), mockRequest()) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('DB connection lost');
    });
  });

  // ── getTasks ───────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    const validInput = {
      start_date: '2026-06-27',
      end_date: '2026-06-27',
    };

    it('should call tasksService.getTasks with parsed Date objects', async () => {
      await tool.getTasks(validInput, mockContext(), mockRequest());

      expect(mockTasksService.getTasks).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.objectContaining({
          startDate: new Date('2026-06-27'),
          endDate: new Date('2026-06-27'),
        }),
      );
    });

    it('should return tasks as JSON', async () => {
      const result = await tool.getTasks(validInput, mockContext(), mockRequest());

      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].title).toBe('Fix Stratos MCP');
    });

    it('should pass status filter when provided', async () => {
      await tool.getTasks({ ...validInput, status: 'completed' }, mockContext(), mockRequest());

      expect(mockTasksService.getTasks).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should return an auth error when mcpUserId is missing', async () => {
      const result = await tool.getTasks(validInput, mockContext(), mockRequest(undefined)) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication expired');
    });

    it('should return an error when the service throws', async () => {
      mockTasksService.getTasks.mockRejectedValueOnce(new Error('Query timeout'));

      const result = await tool.getTasks(validInput, mockContext(), mockRequest()) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query timeout');
    });
  });

  // ── updateTask ─────────────────────────────────────────────────────────────

  describe('updateTask', () => {
    const validInput = {
      task_id: 'task-uuid-456',
      title: 'Updated Title',
      scheduled_date: '2026-06-28',
    };

    it('should call tasksService.updateTask with a parsed Date for scheduled_date', async () => {
      await tool.updateTask(validInput, mockContext(), mockRequest());

      expect(mockTasksService.updateTask).toHaveBeenCalledWith(
        'task-uuid-456',
        expect.objectContaining({
          scheduleDate: new Date('2026-06-28'),
        }),
      );
    });

    it('should pass undefined for scheduleDate when scheduled_date is omitted', async () => {
      await tool.updateTask({ task_id: 'task-uuid-456', title: 'No date' }, mockContext(), mockRequest());

      expect(mockTasksService.updateTask).toHaveBeenCalledWith(
        'task-uuid-456',
        expect.objectContaining({ scheduleDate: undefined }),
      );
    });

    it('should return a success message on update', async () => {
      const result = await tool.updateTask(validInput, mockContext(), mockRequest());

      expect(result.content[0].text).toContain('Updated task details successfully');
      expect(result.content[0].text).toContain('Updated Title');
    });

    it('should return a not-found error when service throws P2025', async () => {
      const err: any = new Error('Record not found');
      err.code = 'P2025';
      mockTasksService.updateTask.mockRejectedValueOnce(err);

      const result = await tool.updateTask(validInput, mockContext(), mockRequest()) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Target item not found');
    });
  });

  // ── deleteTask ─────────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    const validInput = { task_id: 'task-uuid-456' };

    it('should call tasksService.deleteTask with the correct task ID', async () => {
      await tool.deleteTask(validInput, mockContext(), mockRequest());

      expect(mockTasksService.deleteTask).toHaveBeenCalledWith('task-uuid-456');
    });

    it('should return a success message on deletion', async () => {
      const result = await tool.deleteTask(validInput, mockContext(), mockRequest());

      expect(result.content[0].text).toContain('task-uuid-456');
      expect(result.content[0].text).toContain('permanently erased');
    });

    it('should return a not-found error when service throws P2025', async () => {
      const err: any = new Error('Record not found');
      err.code = 'P2025';
      mockTasksService.deleteTask.mockRejectedValueOnce(err);

      const result = await tool.deleteTask(validInput, mockContext(), mockRequest()) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Target item not found');
    });

    it('should return an auth error when mcpUserId is missing', async () => {
      const result = await tool.deleteTask(validInput, mockContext(), mockRequest(undefined)) as McpToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication expired');
    });
  });
});