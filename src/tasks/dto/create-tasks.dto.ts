import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsDate,
    IsInt, 
    Min, 
    Max, 
    IsEnum} from 'class-validator';
import { BasePriority } from '@prisma/client';
import { Type } from 'class-transformer';
export class CreateTaskDto {
    @IsNotEmpty()
    @IsString({message: 'Title must be a string'})
    title: string;

    @IsOptional()
    @IsString({message: 'Description must be a string'})
    description?: string;

    @IsOptional()
    @Type(() => Date) // Converts the incoming string into a real JS Date object
    @IsDate({message: 'Scheduled date must be a valid date'})
    scheduleDate?: Date;

    @IsOptional()
    @IsInt({message: 'Estimated minutes must be an integer'})
    @Min(0, {message: 'Estimated minutes must be a positive integer'})
    @Max(1440,{message: "Estimated minutes cannot be higher than 1440"})
    estimatedMinutes?: number;

    @IsOptional()
    @IsEnum(BasePriority, {message: 'Base priority must be one of low, medium, or high'})
    basePriority?: BasePriority;

    @IsOptional()
    @IsString({message: 'Plan ID must be a string'})
    planId?: string;
}