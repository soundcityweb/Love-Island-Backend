import { SchedulePlatform } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export enum ScheduleView {
  daily = 'daily',
  weekly = 'weekly',
  episode = 'episode',
}

export class QueryScheduleDto {
  @IsOptional()
  @IsEnum(ScheduleView)
  @Transform(({ value }) =>
    value === '' || value === undefined || value === null
      ? undefined
      : value,
  )
  view?: ScheduleView;

  /**
   * Anchor calendar date (YYYY-MM-DD). Omitted or blank → daily view returns **all**
   * published slots (paginated with `offset` / `limit`). Weekly view still anchors on “today”.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? undefined : t;
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  /** Pagination for daily “all dates” mode (ignored when `date` is set). */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  })
  @IsInt()
  @Min(0)
  offset?: number;

  /** Page size for daily “all dates” mode (default 30, max 100). */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === undefined || value === null
      ? undefined
      : value,
  )
  @IsEnum(SchedulePlatform)
  platform?: SchedulePlatform;
}
