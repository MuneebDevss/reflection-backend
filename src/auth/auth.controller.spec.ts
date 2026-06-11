import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { HttpStatus } from '@nestjs/common';
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

  // Mocked implementation of AuthService
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

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('login', () => {
    it('should generate tokens and set httpOnly access and refresh cookies', async () => {
      const mockReq = { user: { id: 'uuid', email: 'test@example.com' } };
      const mockRes = createMockResponse();
      
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await controller.login(mockReq, mockRes);

      // Verify AuthService tokens generation was called with request user
      expect(authService.generateTokens).toHaveBeenCalledWith(mockReq.user);

      // Verify access token cookie was correctly set
      expect(mockRes.cookie).toHaveBeenCalledWith('access_token', mockTokens.accessToken, expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      }));

      // Verify refresh token cookie was correctly set
      expect(mockRes.cookie).toHaveBeenCalledWith('refresh_token', mockTokens.refreshToken, expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      }));

      expect(result).toEqual({ success: true, message: 'Logged in successfully' });
    });
  });

  describe('refresh', () => {
    it('should accept a validated refresh token payload and yield new pairs', async () => {
      const mockReq = {
        user: {
          id: 'uuid',
          email: 'test@example.com',
          refreshToken: 'old-refresh-token',
        },
      };

      const mockTokens = {
        accessToken: 'rotated-access-token',
        refreshToken: 'rotated-refresh-token',
      };

      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      const result = await controller.refresh(mockReq);

      // Verify that the 'refreshToken' property was stripped out from the user payload
      expect(authService.generateTokens).toHaveBeenCalledWith({
        id: 'uuid',
        email: 'test@example.com',
      });

      expect(result).toEqual({
        access_token: mockTokens.accessToken,
        refresh_token: mockTokens.refreshToken,
      });
    });
  });

  describe('logout', () => {
    it('should call clearCookie for both tokens and confirm operation', async () => {
      const mockRes = createMockResponse();

      const result = await controller.logout(mockRes);

      // Assert clean commands are emitted to cookies storage
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