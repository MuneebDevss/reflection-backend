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
  async register(registerDto: RegisterDto) {
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
      const token = await this.generateTokens(user);

      return {
        user: userWithoutPassword,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
      };
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
  async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      email: user.email,
      sub: user.id,
    };

    // 1. Sign the short-lived Access Token
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET, // Distinct secret for access tokens
      expiresIn: '15m',                     // Expires in 15 minutes
    });

    // 2. Sign the long-lived Refresh Token
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET, // Distinct secret for refresh tokens
      expiresIn: '7d',                       // Expires in 7 days
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
