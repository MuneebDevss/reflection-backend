import { IsString, IsNotEmpty } from 'class-validator';

export class CreateGoalSessionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  rawGoalText: string;
}
