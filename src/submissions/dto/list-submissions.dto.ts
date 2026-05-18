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

export type SubmissionStatus =
  | 'active'
  | 'approved'
  | 'rejected'
  | 'disqualified'
  | 'winner';

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  'active',
  'approved',
  'rejected',
  'disqualified',
  'winner',
];

/**
 * Query parameters for listing submissions.
 * Applies to both the global list and competition-scoped list.
 */
export class ListSubmissionsDto {
  /** Filter to a single competition UUID. */
  @IsOptional()
  @IsUUID()
  competitionId?: string;

  /** Filter by competition type. */
  @IsOptional()
  @IsEnum(CompetitionType)
  type?: CompetitionType;

  /** Filter by submission moderation status. */
  @IsOptional()
  @IsEnum(SUBMISSION_STATUSES)
  status?: SubmissionStatus;

  /** Partial, case-insensitive match against userId. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** ISO-8601 inclusive start of the submission date range. */
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  /** ISO-8601 inclusive end of the submission date range. */
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  /** Sort field. Default: createdAt. */
  @IsOptional()
  @IsEnum(['createdAt', 'score', 'status'])
  sortBy?: 'createdAt' | 'score' | 'status';

  /** Sort direction. Default: DESC. */
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC';

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
