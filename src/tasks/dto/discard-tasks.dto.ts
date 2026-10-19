import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class DiscardTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  taskIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
