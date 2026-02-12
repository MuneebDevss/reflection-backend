/**
 * EXAMPLE: How to Protect Routes with JWT Authentication
 * 
 * This file demonstrates how to use JwtAuthGuard to protect your endpoints
 * Copy this pattern to your controllers
 */

import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('example')
export class ExampleController {
  /**
   * Public endpoint - no authentication required
   */
  @Get('public')
  getPublicData() {
    return {
      message: 'This is public data, accessible to everyone',
    };
  }

  /**
   * Protected endpoint - requires JWT authentication
   * 
   * Client must include JWT token in Authorization header:
   * Authorization: Bearer <token>
   * 
   * The authenticated user info is available in req.user:
   * - req.user.userId (string)
   * - req.user.email (string)
   */
  @UseGuards(JwtAuthGuard)
  @Get('protected')
  getProtectedData(@Request() req) {
    return {
      message: 'This is protected data',
      user: {
        id: req.user.userId,
        email: req.user.email,
      },
    };
  }

  /**
   * Protected POST endpoint example
   * Demonstrates accessing user ID for database operations
   */
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createResource(@Body() data: any, @Request() req) {
    const userId = req.user.userId;
    
    // Use userId to associate resources with the authenticated user
    // Example: creating a goal for the authenticated user
    return {
      message: 'Resource created',
      userId: userId,
      data: data,
    };
  }

  /**
   * Multiple guards can be applied
   * This is useful if you want to add custom guards (e.g., role-based)
   */
  @UseGuards(JwtAuthGuard /* , RoleGuard */)
  @Get('admin')
  getAdminData(@Request() req) {
    return {
      message: 'Admin only data',
      user: req.user,
    };
  }
}

/**
 * Usage in your existing controllers:
 * 
 * 1. Import the guard:
 *    import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
 * 
 * 2. Add @UseGuards(JwtAuthGuard) to protected routes
 * 
 * 3. Access authenticated user via @Request() req parameter:
 *    req.user.userId - User's ID
 *    req.user.email - User's email
 * 
 * Example for Goals Controller:
 * 
 * @UseGuards(JwtAuthGuard)
 * @Post()
 * async create(@Body() createGoalDto: CreateGoalDto, @Request() req) {
 *   // Use req.user.userId to associate goal with authenticated user
 *   return this.goalsService.create({
 *     ...createGoalDto,
 *     userId: req.user.userId,
 *   });
 * }
 */
