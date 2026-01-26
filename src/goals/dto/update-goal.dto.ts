import { IsInt, Min, Max, IsOptional } from 'class-validator';

export class UpdateGoalDto {
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;
}
