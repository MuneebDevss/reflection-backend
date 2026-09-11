// src/auth/guards/rt.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for protecting routes with JWT authentication
 * Apply this guard to routes that require authentication
 * 
 * Usage:
 * @UseGuards(RefreshTokenGuard)
 * async getProtectedResource() { ... }
 */
@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {}
