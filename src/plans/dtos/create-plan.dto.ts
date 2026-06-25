import { IsOptional, IsString } from 'class-validator';

export class CreatePlanDto {
  @IsString({message: 'Name must be a string'})
  name: string;

  @IsOptional()
  @IsString({message: 'Description must be a string'})
  description?: string;

  @IsOptional()
  @IsString({message: 'Source must be a string'})
  source?: 'mcp' | 'manual';
}