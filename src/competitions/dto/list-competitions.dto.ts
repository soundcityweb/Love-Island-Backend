import { IsOptional, IsEnum, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CompetitionType } from '../../entities/competition-type.enum';
import { CompetitionStatus } from '../../entities/competition-status.enum';

/**
 * Query-string parameters for GET /competitions.
 * All params are optional; defaults produce a page-1, 20-item, all-status list.
 */
export class ListCompetitionsDto {
  /**
   * Page number (1-based).
   * @example ?page=2
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1)
  page: number = 1;

  /**
   * Items per page. Max 100.
   * @example ?limit=10
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1)
  @Max(100)
  limit: number = 20;

  /**
   * Filter by competition status.
   * When omitted, all non-draft competitions are returned.
   * @example ?status=active
   */
  @IsOptional()
  @IsEnum(CompetitionStatus, {
    message: `status must be one of: ${Object.values(CompetitionStatus).join(', ')}`,
  })
  status?: CompetitionStatus;

  /**
   * Filter by competition type.
   * @example ?type=quiz
   */
  @IsOptional()
  @IsEnum(CompetitionType, {
    message: `type must be one of: ${Object.values(CompetitionType).join(', ')}`,
  })
  type?: CompetitionType;

  /**
   * Case-insensitive substring search across title and description.
   * Max 100 characters to prevent expensive LIKE queries.
   * @example ?search=weekly
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

// ── Shared pagination envelope ─────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
