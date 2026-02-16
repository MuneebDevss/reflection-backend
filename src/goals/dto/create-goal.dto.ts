import { IsString, IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  deadline: string;
}
