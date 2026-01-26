import { IsString, IsNotEmpty } from 'class-validator';

export class CreateAnswerDto {
  @IsString()
  @IsNotEmpty()
  answerText: string;
}
