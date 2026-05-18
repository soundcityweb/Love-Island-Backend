import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IslanderStatus } from '../../entities/islander-status.enum';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'slug must contain only lowercase letters, numbers and hyphens (e.g. jane-doe)';

const FUN_FACT_ICONS = ['heart', 'music', 'food', 'sparkle', 'sun', 'flame'] as const;
const SOCIAL_PLATFORMS = ['instagram', 'twitter', 'x', 'tiktok'] as const;

export class FunFactDto {
  @IsIn(FUN_FACT_ICONS, { message: 'icon must be one of: heart, music, food, sparkle, sun, flame' })
  icon: string;

  @IsString()
  @IsNotEmpty({ message: 'fun fact label is required.' })
  label: string;

  @IsString()
  @IsNotEmpty({ message: 'fun fact value is required.' })
  value: string;
}

export class SocialLinkDto {
  @IsIn(SOCIAL_PLATFORMS, { message: 'platform must be one of: instagram, twitter, x, tiktok' })
  platform: string;

  @IsString()
  @IsNotEmpty({ message: 'social handle is required.' })
  handle: string;

  @IsString()
  @IsUrl({}, { message: 'url must be a valid URL.' })
  url: string;
}

export class CreateIslanderDto {
  @IsString()
  @IsNotEmpty({ message: 'firstName is required.' })
  @MaxLength(100)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;

  @Type(() => Number)
  @IsInt()
  @Min(18)
  age: number;

  @IsString()
  @IsNotEmpty({ message: 'location is required.' })
  @MaxLength(200)
  location: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  lookingFor?: string;

  @IsOptional()
  @IsEnum(IslanderStatus)
  status?: IslanderStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  profileStatusLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  profileImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunFactDto)
  funFacts?: FunFactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  ogImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  twitterImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  keywords?: string;
}
