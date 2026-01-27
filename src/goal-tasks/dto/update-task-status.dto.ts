import { IsEnum } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsEnum(['PENDING', 'COMPLETED', 'SKIPPED'])
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
}
