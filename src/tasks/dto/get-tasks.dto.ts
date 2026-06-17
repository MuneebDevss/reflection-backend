import { IsDate, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetTasks {
    @IsOptional()
    @Type(() => Date) // 1. Converts the incoming string "2026-06-16" into a real JS Date object
    @IsDate({ message: 'Date must be a valid date' })
    startDate?: Date; // 2. Renamed to match your URL parameter (?startDate=...)
    
    @IsOptional()
    @Type(() => Date) // Converts the incoming string into a real JS Date object
    @IsDate({ message: 'Date must be a valid date' })
    endDate?: Date; // Renamed to match your URL parameter (?endDate=...)

    @IsOptional()
    @IsEnum(['pending', 'completed'], {message: 'Status must be either pending or completed'})
    status?: 'pending' | 'completed';

    @IsOptional() // Makes it optional if it isn't always required
    @IsString({ message: 'PlanId must be a string value' })
    planId?: string;
}