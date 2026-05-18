import {
  IsString,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  MinLength,
} from 'class-validator';

export class UpdateVotingEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Name must not be empty when provided.' })
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  resultsPublic?: boolean;

  /** When status is DRAFT, replace the event's contestants with this list (unique islander IDs). */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each contestant ID must be a valid UUID.' })
  contestantIds?: string[];
}
