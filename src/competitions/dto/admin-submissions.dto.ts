import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompetitionType } from '../../entities/competition-type.enum';

export type SubmissionStatus = 'active' | 'approved' | 'rejected' | 'disqualified' | 'winner';

export class ListSubmissionsDto {
  @IsOptional()
  @IsUUID()
  competitionId?: string;

  @IsOptional()
  @IsEnum(CompetitionType)
  type?: CompetitionType;

  @IsOptional()
  @IsString()
  status?: SubmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateSubmissionStatusDto {
  @IsEnum(['active', 'approved', 'rejected', 'disqualified', 'winner'])
  status: SubmissionStatus;
}
