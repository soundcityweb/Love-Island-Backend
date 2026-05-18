import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CrossLinkDto } from './cross-link.dto';
import { RequireAudioOrVideoUrl } from '../validators/audio-or-video-url.constraint';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE =
  'slug must contain only lowercase letters, numbers and hyphens (e.g. episode-01)';

const PODCAST_STATUSES = ['draft', 'published'] as const;

export class CreatePodcastEpisodeDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required.' })
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;

  @RequireAudioOrVideoUrl()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2048)
  audioUrl?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CrossLinkDto)
  crossLinks?: CrossLinkDto[];

  @IsOptional()
  @IsString()
  @IsIn(PODCAST_STATUSES, { message: 'status must be draft or published.' })
  status?: (typeof PODCAST_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
