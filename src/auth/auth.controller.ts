import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshTokenGuard } from './guards/rt.guard';
import { Response } from 'express';
/**
 * AuthController handles authentication endpoints
 * Provides registration and login functionality
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * POST /auth/register
   * 
   * @param registerDto - Registration data (email, password, optional name)
   * @returns User object and JWT access token
   * 
   * Example request body:
   * {
   *   "email": "user@example.com",
   *   "password": "securePassword123",
   *   "timezone": "America/New_York"
   * }
   * 
   * Example response:
   * {
   *   "user": {
   *     "id": "uuid",
   *     "email": "user@example.com",
   *     "timezone": "America/New_York",
   *     "createdAt": "2026-02-12T...",
   *     "updatedAt": "2026-02-12T..."
   *   },
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login with email and password
   * POST /auth/login
   * 
   * Uses LocalAuthGuard to validate credentials via LocalStrategy
   * If credentials are valid, returns user and JWT token
   * 
   * @param loginDto - Login credentials (email and password)
   * @param req - Request object with validated user (populated by LocalStrategy)
   * @returns User object and JWT access token
   * 
   * Example request body:
   * {
   *   "email": "user@example.com",
   *   "password": "securePassword123"
   * }
   * 
   * Example response:
   * {
   *   "user": {
   *     "id": "uuid",
   *     "email": "user@example.com",
   *     "timezone": "America/New_York",
   *     "createdAt": "2026-02-12T...",
   *     "updatedAt": "2026-02-12T..."
   *   },
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.generateTokens(req.user);

    // 1. Attach the Access Token as an httpOnly cookie
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production (HTTPS)
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // 2. Attach the Refresh Token as a separate httpOnly cookie
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { success: true, message: 'Logged in successfully' };
  }

  /**
   * Refresh JWT token using refresh token
   * POST /auth/refresh
   *
   * Uses RefreshTokenGuard to validate refresh token via RefreshTokenStrategy
   * If refresh token is valid, returns new JWT access token
   *
   * @param req - Request object with validated user and refresh token (populated by RefreshTokenStrategy)
   * @return New JWT access token
   *  Example response:
   * {
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   * Note: The refresh token is typically sent in the Authorization header as a Bearer token
   * Example request header:
   * Authorization: Bearer <refresh_token>
   */
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req) {
    // req.user is populated by RefreshTokenStrategy after successful validation
    const { refreshToken, ...user } = req.user;
    const newAccessToken = await this.authService.generateTokens(user);
    return {
      access_token: newAccessToken.accessToken,
      refresh_token: newAccessToken.refreshToken, // Optionally return the same refresh token or generate a new one
    };
  }
  /**
   * Logout user by clearing authentication cookies
   * POST /auth/logout
   * Clears both access_token and refresh_token cookies to effectively log out the user
   * @returns Success message
   * Example response:
   * {
   *  "success": true,
   * "message": "Logged out successfully"
   * }
   * Note: The client should also clear any stored tokens on their side for complete logout
   * Example request header:
   * Authorization: Bearer <access_token>
   */
  @UseGuards(RefreshTokenGuard) // Ensure only authenticated users can log out
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    // Clear the access_token cookie
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    // Clear the refresh_token cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return { success: true, message: 'Logged out successfully' };
  }
}
