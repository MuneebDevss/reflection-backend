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
      
      if (!user || !user.password) {
        return null;
      }

      // Compare provided password with hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return null;
      }

      // Return user without password
      const { password: _, ...result } = user;
      return result;
    } catch (error) {
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
        name: registerDto.name,
        password: hashedPassword,
      } as any);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user as any;

      // Generate JWT token
      const token = await this.generateToken(user);

      return {
        user: userWithoutPassword,
        access_token: token,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      
      this.logger.error(`Failed to register user: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Logs in a user and generates JWT token
   * @param user - User object (already validated by LocalStrategy)
   * @returns User object and JWT token
   */
  async login(user: any) {
    const token = await this.generateToken(user);

    return {
      user,
      access_token: token,
    };
  }

  /**
   * Generates JWT token for authenticated user
   * @param user - User object
   * @returns JWT token string
   */
  private async generateToken(user: any): Promise<string> {
    const payload = {
      email: user.email,
      sub: user.id, // 'sub' is standard JWT claim for user identifier
    };

    return this.jwtService.sign(payload);
  }
}
