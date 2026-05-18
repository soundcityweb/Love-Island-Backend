import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreatePodcastEpisodeDto } from './create-podcast-episode.dto';
import { RequireAudioOrVideoUrlWhenBothSent } from '../validators/audio-or-video-url.constraint';

/**
 * Partial update; `audioUrl` / `videoUrl` are re-declared so we do not inherit
 * create-only “at least one media URL” logic that would reject `{}` patches.
 * When both keys are present in the body, pair validation applies; merged state is checked in the service.
 */
export class UpdatePodcastEpisodeDto extends PartialType(
  OmitType(CreatePodcastEpisodeDto, ['audioUrl', 'videoUrl'] as const),
) {
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2048)
  audioUrl?: string;

  @RequireAudioOrVideoUrlWhenBothSent()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;
}
