import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

/**
 * DTO for user registration
 */
export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
