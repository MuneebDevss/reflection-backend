import { IsEnum } from 'class-validator';

export class GetAllTasksDto {
  @IsEnum(['LastWeek', 'LastDay', 'LastMonth', 'AllTime'])
  period: 'LastWeek' | 'LastDay' | 'LastMonth' | 'AllTime';
}
