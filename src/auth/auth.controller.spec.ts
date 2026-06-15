import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  // Mocked Response implementation for Express cookies
  const createMockResponse = () => {
    const res = {} as Partial<Response>;
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  // Mocked implementation of AuthService updated to match real usage
  const mockAuthService = {
    register: jest.fn(),
    generateTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a user and return the service output', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        timezone: 'America/New_York',
      };
      const expectedResult = {
        user: { id: 'uuid', email: 'test@example.com' },
        access_token: 'mock-access-token',
      };

      const mockResponse = createMockResponse();
      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(dto, mockResponse);

      expect(authService.register).toHaveBeenCalledWith(dto, mockResponse);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('login', () => {
    it('should call generateTokens with email, id, and response context', async () => {
      const mockReq = { user: { id: 'uuid-1234', email: 'test@example.com' } };
      const mockRes = createMockResponse();
      
      const expectedTokensResult = {
        user: { id: 'uuid-1234', email: 'test@example.com' },
        access_token: 'new-access-token',
      };

      mockAuthService.generateTokens.mockResolvedValue(expectedTokensResult);

      const result = await controller.login(mockReq, mockRes);

      // Matches controller implementation precisely: (email, id, res)
      expect(authService.generateTokens).toHaveBeenCalledWith(
        mockReq.user.email,
        mockReq.user.id,
        mockRes
      );

      expect(result).toEqual(expectedTokensResult);
    });
  });

  describe('refresh', () => {
    it('should accept a validated refresh token payload and yield new pairs via service', async () => {
      const mockReq = {
        user: {
          userId: 'uuid-1234',
          email: 'test@example.com',
          refreshToken: 'old-refresh-token',
        },
      };
      const mockRes = createMockResponse();

      const expectedTokensResult = {
        user: { id: 'uuid-1234', email: 'test@example.com' },
        access_token: 'rotated-access-token',
      };

      mockAuthService.generateTokens.mockResolvedValue(expectedTokensResult);
      
      const result = await controller.refresh(mockReq, mockRes);

      // Asserts handling matches updated strategy payload structure: (email, userId, res)
      expect(authService.generateTokens).toHaveBeenCalledWith(
        mockReq.user.email,
        mockReq.user.userId,
        mockRes
      );

      expect(result).toEqual(expectedTokensResult);
    });
  });

  describe('logout', () => {
    it('should call clearCookie for both tokens directly and confirm operation', async () => {
      const mockRes = createMockResponse();

      const result = await controller.logout(mockRes);

      // Assert clear commands match controller definitions exactly
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
      }));

      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
      }));

      expect(result).toEqual({ success: true, message: 'Logged out successfully' });
    });
  });
});