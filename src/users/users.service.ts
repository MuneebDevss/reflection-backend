import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: createUserDto,
      });
    } catch (error) {
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

  async findAll() {
    try {
      return await this.prisma.user.findMany({
        include: {
          goals: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to fetch users: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch users');
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
          goals: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(`Failed to fetch user ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) || /^[a-zA-Z0-9-_]+$/.test(id); // Allow custom IDs like 'user-1'
  }
}
