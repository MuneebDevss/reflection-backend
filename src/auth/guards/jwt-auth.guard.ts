import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for protecting routes with JWT authentication
 * Apply this guard to routes that require authentication
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard)
 * async getProtectedResource() { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
