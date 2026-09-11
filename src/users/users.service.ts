import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { Prisma } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createUserDto: RegisterDto) {
    try {
      return await this.prisma.user.create({
        data: createUserDto,
      });
    } catch (error: any) {
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Unique constraint violation
        if (error.code === 'P2002') {
          throw new ConflictException('A user with this email already exists');
        }
      }
      
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async getConnectionStatus(userId: string) {
      const token = await this.prisma.oAuthAccessToken.findFirst({
        where: { userId, refreshExpiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      })
      if (!token) return { connected: false, connectedAt: null, expiresAt: null, clientName: null }
      return {
        connected: true,
        connectedAt: token.createdAt.toISOString(),
        expiresAt: token.refreshExpiresAt.toISOString(),
        clientName: token.client.clientName,
      }
    }

  async findOne(id: string) {
    try {
      // Validate UUID format
      if (!this.isValidUUID(id)) {
        throw new BadRequestException('Invalid user ID format');
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          tasks: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error: any ) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(`Failed to fetch user ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  /**
   * Find user by email - used for authentication
   * Returns user with password field for authentication purposes
   */
  async findByEmail(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      return user;
    } catch (error: any) {
      this.logger.error(`Failed to fetch user by email: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  /**
   * Update user information 
   * @param id 
   * @param updateUserData 
   * @returns 
   */

  async update(id: string, updateUserData: Partial<UpdateUserDto>) {
      // Validate UUID format
      if (!this.isValidUUID(id)) {
        throw new BadRequestException('Invalid user ID format');
      }
      return this.prisma.user.update({
        where: { id },
        data: {
          dailyCapacityMinutes: updateUserData.dailyCapacityMinutes,
          timezone: updateUserData.timezone,
          theme: updateUserData.theme,
        },
      });
    }
  

  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) || /^[a-zA-Z0-9-_]+$/.test(id); // Allow custom IDs like 'user-1'
  }
}
