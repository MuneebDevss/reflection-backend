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
export class UpdateTaskDto {
    @IsOptional()
    @IsString({message: 'Title must be a string'})
    title?: string;
    

    @IsOptional()
    @IsString({message: 'Description must be a string'})
    description?: string;

    @IsOptional()
    @IsDate({message: 'Schedule date must be a valid date'})
    scheduleDate?: Date;

    @IsOptional()
    @IsInt({message: 'Estimated minutes must be an integer'})
    @Min(0, {message: 'Estimated minutes must be a positive integer'})
    estimatedMinutes?: number;

    @IsOptional()
    @IsEnum(BasePriority, {message: 'Base priority must be one of low, medium, or high'})
    basePriority?: BasePriority;

    @IsOptional()
    @IsEnum(['pending', 'completed'], {message: 'Status must be either pending or completed'})
    status?: 'pending' | 'completed';

}