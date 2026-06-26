import { 
  Injectable, 
  ConflictException, 
  UnauthorizedException,
  Logger 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
/**
 * AuthService handles authentication logic
 * - User registration with password hashing
 * - User validation for login
 * - JWT token generation
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validates user credentials for login
   * @param email - User email
   * @param password - Plain text password
   * @returns User object without password if valid, null otherwise
   */
  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findByEmail(email);
      
      if (!user || !user.passwordHash) {
        return null;
      }

      // Compare provided password with hashed password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isPasswordValid) {
        console.log(`Password mismatch for user ${email}`);
        return null;
      }

      // Return user without password
      const { passwordHash: _, ...result } = user;
      return result;
    } catch (error : any) {
      this.logger.error(`Failed to validate user: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Registers a new user
   * @param registerDto - Registration data including email, password, and optional name
   * @returns User object and JWT token
   */
  async register(registerDto: RegisterDto, res: Response) {
    try {
      // Check if user already exists
      const existingUser = await this.usersService.findByEmail(registerDto.email);
      
      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      // Hash password before saving
      const hashedPassword = await bcrypt.hash(registerDto.password, this.SALT_ROUNDS);

      // Create user with hashed password
      const user = await this.usersService.create({
        email: registerDto.email,
        passwordHash: hashedPassword,
        timezone: registerDto.timezone,
      } as any);

      // Remove password from response
      const { passwordHash: _, ...userWithoutPassword } = user as any;

      // Generate JWT token
      await this.generateTokens(user.email, user.id, res);

      return { message: 'User registered successfully' };
    } catch (error : any) {
      if (error instanceof ConflictException) {
        throw error;
      }
      
      this.logger.error(`Failed to register user: ${error.message}`, error.stack);
      throw error;
    }
  }

  
  /**
   * Generates JWT token for authenticated user
   * @param user - User object
   * @returns JWT token string
   */
  async generateTokens(email: string, userId: string, res: Response): Promise<void> {
    const payload = {
      email: email,
      sub: userId,
    };

    // 1. Sign the short-lived Access Token
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production', // Distinct secret for access tokens
      expiresIn: '15m',                     // Expires in 15 minutes
    });

    // 2. Sign the long-lived Refresh Token
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'rt-secret', // Distinct secret for refresh tokens
      expiresIn: '7d',                       // Expires in 7 days
    });

    // 1. Attach the Access Token as an httpOnly cookie
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production (HTTPS)
      sameSite: 'none', // Adjust based on your frontend domain and CORS settings
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // 2. Attach the Refresh Token as a separate httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
  
}
