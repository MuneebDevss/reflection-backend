import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
export class UpdateUserDto {
  @IsOptional()
  @IsNumber({})
  @Min(0,{message: "Daily Capacity Minutse cannot be lower than 0"})
  @Max(1440,{message: "Daily Capacity Minutes cannot be higher than 1440"})
  dailyCapacityMinutes?: number;
  
  @IsOptional()
  @IsString({message: "Timezone must be a string"})
  timezone?: string;

}
  

