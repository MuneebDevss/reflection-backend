import { IsDate, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetTasksByDateDto {
    @IsNotEmpty()
    @Type(() => Date) // 1. Converts the incoming string "2026-06-16" into a real JS Date object
    @IsDate({ message: 'Date must be a valid date' })
    startDate: Date; // 2. Renamed to match your URL parameter (?startDate=...)
    
    @IsNotEmpty()
    @Type(() => Date) // Converts the incoming string into a real JS Date object
    @IsDate({ message: 'Date must be a valid date' })
    endDate: Date; // Renamed to match your URL parameter (?endDate=...)

    @IsOptional() // Makes it optional if it isn't always required
    @Transform(({ value }) => value === 'true' || value === true) // 3. Converts string "true" to boolean true
    @IsBoolean({ message: 'Include capacity must be a boolean value' })
    includeCapacity: boolean;
}