import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for local authentication (username/password)
 * Used on login endpoint to validate credentials
 * 
 * Usage:
 * @UseGuards(LocalAuthGuard)
 * async login(@Request() req) { ... }
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
