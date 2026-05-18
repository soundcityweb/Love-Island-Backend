import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'slug must contain only lowercase letters, numbers and hyphens (e.g. my-video)';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required.' })
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'embedUrl is required.' })
  @IsUrl({}, { message: 'embedUrl must be a valid URL.' })
  @MaxLength(512)
  embedUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  thumbnail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
