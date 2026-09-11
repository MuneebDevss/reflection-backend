import { IsOptional, IsNumber, IsString, Min, Max, IsEnum } from 'class-validator';
export class UpdateUserDto {
  @IsOptional()
  @IsNumber({})
  @Min(0,{message: "Daily Capacity Minutse cannot be lower than 0"})
  @Max(1440,{message: "Daily Capacity Minutes cannot be higher than 1440"})
  dailyCapacityMinutes?: number;
  
  @IsOptional()
  @IsString({message: "Timezone must be a string"})
  timezone?: string;

  @IsOptional()
  @IsEnum(['light', 'dark'], {message: "Theme must be either 'light' or 'dark'"})
  theme?: 'light' | 'dark';

}
  

