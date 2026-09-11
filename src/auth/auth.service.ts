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
        this.logger.warn(`Password mismatch for user ${email}`);
        return null;
      }

      const { passwordHash: _, ...result } = user;
      return result;
    } catch (error: any) {
      this.logger.error(`Failed to validate user: ${error.message}`, error.stack);
      return null;
    }
  }

  async register(registerDto: RegisterDto) {
    try {
      const existingUser = await this.usersService.findByEmail(registerDto.email);
      
      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      const hashedPassword = await bcrypt.hash(registerDto.password, this.SALT_ROUNDS);

      const user = await this.usersService.create({
        email: registerDto.email,
        passwordHash: hashedPassword,
        timezone: registerDto.timezone,
      } as any);

      const { passwordHash: _, ...userWithoutPassword } = user as any;
      const tokens = await this.generateTokens(user.email, user.id);

      return {
        message: 'User registered successfully',
        user: userWithoutPassword,
        ...tokens,
      };
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }
      
      this.logger.error(`Failed to register user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateTokens(email: string, userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      email,
      sub: userId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'rt-secret',
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}