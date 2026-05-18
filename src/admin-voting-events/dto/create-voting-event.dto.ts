import { IsString, IsDateString, IsOptional, MinLength } from 'class-validator';

export class CreateVotingEventDto {
  @IsString()
  @MinLength(1, { message: 'Code is required' })
  code: string;

  @IsString()
  @MinLength(1, { message: 'Name is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;
}
