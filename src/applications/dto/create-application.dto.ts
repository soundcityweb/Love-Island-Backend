import {
  IsString,
  IsEmail,
  IsInt,
  Min,
  Max,
  Length,
  IsIn,
  MinLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const GENDER_OPTIONS = ['male', 'female', 'non-binary', 'prefer-not-to-say'] as const;

const FUN_FACT_ICONS = ['heart', 'music', 'food', 'sparkle', 'sun', 'flame'] as const;
const SOCIAL_PLATFORMS = ['instagram', 'twitter', 'x', 'tiktok'] as const;

export class FunFactItemDto {
  @IsIn(FUN_FACT_ICONS, { message: 'Icon must be one of: heart, music, food, sparkle, sun, flame' })
  icon: string;

  @IsString()
  @MinLength(1)
  label: string;

  @IsString()
  @MinLength(1)
  value: string;
}

export class SocialLinkItemDto {
  @IsIn(SOCIAL_PLATFORMS, { message: 'Platform must be one of: instagram, twitter, x, tiktok' })
  platform: string;

  @IsString()
  @MinLength(1)
  handle: string;

  @IsString()
  @IsUrl()
  url: string;
}

export class CreateApplicationDto {
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  firstName: string;

  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phone: string;

  @Type(() => Number)
  @IsInt()
  @Min(18, { message: 'Age must be at least 18' })
  @Max(40, { message: 'Age must be at most 40' })
  age: number;

  @IsString()
  @IsIn(GENDER_OPTIONS, { message: 'Please select a valid gender' })
  gender: string;

  @IsString()
  @MinLength(1, { message: 'City is required' })
  city: string;

  @IsString()
  @MinLength(1, { message: 'Occupation is required' })
  occupation: string;

  @IsString()
  @MinLength(1, { message: 'Bio is required' })
  @Length(1, 500, { message: 'Bio must be between 1 and 500 characters' })
  bio: string;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'Tagline must be at most 200 characters' })
  tagline?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'lookingFor must be at most 1000 characters' })
  lookingFor?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'Profile status label must be at most 200 characters' })
  profileStatusLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  primaryImageIndex?: number;

  @IsOptional()
  @Transform(({ value }) => {
    const raw = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    if (!Array.isArray(raw)) return [];
    return raw.map((item: Record<string, unknown>) => Object.assign(new FunFactItemDto(), item));
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunFactItemDto)
  funFacts?: FunFactItemDto[];

  @IsOptional()
  @Transform(({ value }) => {
    const raw = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    if (!Array.isArray(raw)) return [];
    return raw.map((item: Record<string, unknown>) => Object.assign(new SocialLinkItemDto(), item));
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkItemDto)
  socialLinks?: SocialLinkItemDto[];
}
