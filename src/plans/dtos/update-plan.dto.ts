import { IsOptional, IsString } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString({message: 'Name must be a string'})
  name?: string;

  @IsOptional()
  @IsString({message: 'Description must be a string'})
  description?: string;

}
