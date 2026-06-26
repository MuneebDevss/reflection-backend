import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { BasePriority, TaskStatus } from '@prisma/client';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: PrismaService;

  // Create a deep mock object for all the Prisma operations your service uses
  const mockPrismaService = {
    task: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService, // This satisfies the constructor dependency injection!
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTasks', () => {
    it('should call prisma.task.findMany with correct arguments', async () => {
      const userId = 'user-123';
      const expectedTasks = [{ id: 'task-1', title: 'Test Task', userId }];
      
      mockPrismaService.task.findMany.mockResolvedValue(expectedTasks);

      const result = await service.getTasks(userId,{});

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual(expectedTasks);
    });
  });

  describe('getOverdueTasks', () => {
    it('should call prisma.task.findMany with a lower-than date filter and incomplete status', async () => {
      const userId = 'user-123';
      mockPrismaService.task.findMany.mockResolvedValue([]);

      await service.getOverdueTasks(userId);

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          scheduledDate: {
            lt: expect.any(Date), // Checks that a date object was constructed and passed
          },
          status: TaskStatus.pending, // Checks that the correct status filter is applied
        },
      });
    });
  });
});