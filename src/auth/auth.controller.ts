import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';

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
   *   "name": "John Doe"
   * }
   * 
   * Example response:
   * {
   *   "user": {
   *     "id": "uuid",
   *     "email": "user@example.com",
   *     "name": "John Doe",
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
   *     "name": "John Doe",
   *     "createdAt": "2026-02-12T...",
   *     "updatedAt": "2026-02-12T..."
   *   },
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req) {
    // req.user is populated by LocalStrategy after successful validation
    return this.authService.login(req.user);
  }
}
