import { ScheduleContentType, SchedulePlatform } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** Local time of day (24h), optional seconds. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateScheduleDto {
  @IsString()
  @MaxLength(10_000)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  episodeNumber?: number;

  @IsEnum(ScheduleContentType)
  contentType!: ScheduleContentType;

  @IsEnum(SchedulePlatform)
  platform!: SchedulePlatform;

  /** Calendar date (YYYY-MM-DD). */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsString()
  @Matches(TIME_RE)
  startTime!: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_RE)
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
