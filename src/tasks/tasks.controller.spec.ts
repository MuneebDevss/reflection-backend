import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { BasePriority, Task, TaskStatus } from '@prisma/client';
import { CreateTaskDto } from './dto/create-tasks.dto';
import { UpdateTaskDto } from './dto/update-tasks.dto';
import { GetTasksByDateDto } from './dto/get-tasks-by-date.dto';

describe('TasksController', () => {
  let controller: TasksController;
  let service: TasksService;

  // Mocked user ID that will be supplied by our custom AuthenticatedRequest
  const mockUserId = 'user-uuid-1234';

  // Shared mock task structure matching the Prisma Task model
  const mockTask: Task = {
      id: 'task-uuid-5678',
      userId: mockUserId,
      title: 'Test Task',
      description: 'This is a test description',
      scheduledDate: new Date('2026-06-15'),
      estimatedMinutes: 30,
      basePriority: BasePriority.medium,
      status: TaskStatus.pending,
      createdAt: new Date(),
      updatedAt: new Date(),
      planId: '',
      compositeScore: 0,
      bumpCount: 0
  };

  // Create a robust mock object for TasksService
  const mockTasksService = {
    getTasks: jest.fn(),
    getOverdueTasks: jest.fn(),
    getGraveyardTasks: jest.fn(),
    getTaskById: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
  };

  // Mocked Express request object simulating JwtAuthGuard injection
  const mockRequest =   mockUserId;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService, // Swap actual service with our mock
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear call histories between individual tests
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTasks', () => {
    /**
     * Verifies that getTasks pulls tasks linked directly to the authed userId
     */
    it('should return an array of tasks for the authenticated user', async () => {
      const mockResult: Task[] = [mockTask];
      mockTasksService.getTasks.mockResolvedValue(mockResult);

      const result = await controller.getTasks(mockRequest, new GetTasksByDateDto());

      expect(service.getTasks).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getOverdueTasks', () => {
    /**
     * Verifies that getOverdueTasks targets the correct user context
     */
    it('should return overdue tasks for the authenticated user', async () => {
      const mockResult: Task[] = [mockTask];
      mockTasksService.getOverdueTasks.mockResolvedValue(mockResult);

      const result = await controller.getOverdueTasks(mockRequest);

      expect(service.getOverdueTasks).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getGraveyardTasks', () => {
    /**
     * Verifies that getGraveyardTasks targets the correct user context
     */
    it('should return graveyard tasks for the authenticated user', async () => {
      const mockResult: Task[] = [mockTask];
      mockTasksService.getGraveyardTasks.mockResolvedValue(mockResult);

      const result = await controller.getGraveyardTasks(mockRequest);

      expect(service.getGraveyardTasks).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getTaskById', () => {
    /**
     * Verifies routing a precise UUID string parameter down to the service layer
     */
    it('should return a specific task matching the dynamic path ID parameter', async () => {
      mockTasksService.getTaskById.mockResolvedValue(mockTask);

      const result = await controller.getTaskById('task-uuid-5678');

      expect(service.getTaskById).toHaveBeenCalledWith('task-uuid-5678');
      expect(result).toEqual(mockTask);
    });
  });

  describe('createTask', () => {
    /**
     * Verifies payload handling and user attachment behavior during creation
     */
    it('should trigger task creation passing user context alongside task DTO payload', async () => {
      const dto: CreateTaskDto = {
        title: 'New Task',
        scheduleDate: new Date('2026-06-15'),
      };
      mockTasksService.createTask.mockResolvedValue(mockTask);

      const result = await controller.createTask(mockRequest, dto);

      expect(service.createTask).toHaveBeenCalledWith(mockUserId, dto);
      expect(result).toEqual(mockTask);
    });
  });

  describe('updateTask', () => {
    /**
     * Verifies proper argument forwarding to apply partial modifications
     */
    it('should trigger task modifications passing targeted task ID and update payload', async () => {
      const dto: UpdateTaskDto = { title: 'Updated Title' };
      const updatedMockTask = { ...mockTask, title: 'Updated Title' };
      mockTasksService.updateTask.mockResolvedValue(updatedMockTask);

      const result = await controller.updateTask('task-uuid-5678', dto);

      expect(service.updateTask).toHaveBeenCalledWith('task-uuid-5678', dto);
      expect(result).toEqual(updatedMockTask);
    });
  });

  describe('deleteTask', () => {
    /**
     * Verifies target task destruction routing
     */
    it('should execute complete removal workflows based explicitly on task ID', async () => {
      mockTasksService.deleteTask.mockResolvedValue(mockTask);

      const result = await controller.deleteTask('task-uuid-5678');

      expect(service.deleteTask).toHaveBeenCalledWith('task-uuid-5678');
      expect(result).toEqual(mockTask);
    });
  });
});