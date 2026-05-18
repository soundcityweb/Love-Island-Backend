import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IslanderStatus } from '../../entities/islander-status.enum';
import { FunFactDto, SocialLinkDto } from './create-islander.dto';

export class UpdateIslanderDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string | null;
  @IsOptional() @IsString() @MaxLength(256) slug?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(18) age?: number;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(200) occupation?: string | null;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string | null;
  @IsOptional() @IsString() bio?: string | null;
  @IsOptional() @IsString() lookingFor?: string | null;
  @IsOptional() @IsEnum(IslanderStatus) status?: IslanderStatus;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsString() @MaxLength(200) profileStatusLabel?: string | null;
  @IsOptional() @IsString() @MaxLength(512) profileImage?: string | null;
  @IsOptional() @IsString() @MaxLength(512) coverImage?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunFactDto)
  funFacts?: FunFactDto[] | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[] | null;

  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(500) metaDescription?: string | null;
  @IsOptional() @IsString() @MaxLength(512) ogImage?: string | null;
  @IsOptional() @IsString() @MaxLength(512) twitterImage?: string | null;
  @IsOptional() @IsString() @MaxLength(500) keywords?: string | null;
}
