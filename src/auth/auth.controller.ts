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
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.register(registerDto, res);
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
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req, @Res({ passthrough: true }) res: Response) {
    return  this.authService.generateTokens(req.user.email, req.user.id, res);
  }

 /**
   * Refreshes authentication tokens using a valid Refresh Token cookie.
   * Implements Refresh Token Rotation (RTR) for optimal security.
   * POST /auth/refresh
   */
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: any, 
    @Res({ passthrough: true }) res: Response
  ) {
    // 1. req.user is safely populated by your updated RefreshTokenStrategy
    const { userId, email, refreshToken: oldRefreshToken } = req.user;

    // 2. Generate a fresh pair of tokens (RTR - Refresh Token Rotation)
    // Passing both parameters allows your service to revoke the old token in the DB
    return this.authService.generateTokens(email, userId, res);
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
