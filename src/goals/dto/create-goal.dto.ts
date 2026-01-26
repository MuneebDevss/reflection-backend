import { IsString, IsDateString, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  deadline: string;

  @IsInt()
  @Min(0)
  @Max(100)
  progress: number = 0;
}
