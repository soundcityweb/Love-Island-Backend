import { applyDecorators } from '@nestjs/common';
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
  ValidateIf,
} from 'class-validator';

export const AUDIO_OR_VIDEO_URL_MESSAGE =
  'Either audioUrl or videoUrl must be provided; both cannot be empty.';

function trimMediaField(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Create: at least one of audioUrl / videoUrl must be a non-empty string.
 */
@ValidatorConstraint({ name: 'AudioOrVideoUrlRequired', async: false })
export class AudioOrVideoUrlRequiredConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const o = args.object as { audioUrl?: string; videoUrl?: string };
    const audio = trimMediaField(o.audioUrl);
    const video = trimMediaField(o.videoUrl);
    return audio.length > 0 || video.length > 0;
  }

  defaultMessage(): string {
    return AUDIO_OR_VIDEO_URL_MESSAGE;
  }
}

/**
 * Update: when the client sends **both** `audioUrl` and `videoUrl` in the body,
 * at least one must be non-empty. Single-field patches are validated after merge in the service.
 */
@ValidatorConstraint({ name: 'AudioOrVideoUrlUpdatePair', async: false })
export class AudioOrVideoUrlUpdatePairConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const o = args.object as Record<string, unknown>;
    const hasAudio = Object.prototype.hasOwnProperty.call(o, 'audioUrl');
    const hasVideo = Object.prototype.hasOwnProperty.call(o, 'videoUrl');
    if (!hasAudio || !hasVideo) return true;
    const audio = trimMediaField(o.audioUrl);
    const video = trimMediaField(o.videoUrl);
    return audio.length > 0 || video.length > 0;
  }

  defaultMessage(): string {
    return AUDIO_OR_VIDEO_URL_MESSAGE;
  }
}

/**
 * Custom validation for create: runs even when `audioUrl` is omitted so `{ videoUrl: "…" }` is valid.
 * Place on `audioUrl` together with `@IsOptional()`, `@IsString()`, `@MaxLength()`.
 */
export function RequireAudioOrVideoUrl(validationOptions?: ValidationOptions) {
  return applyDecorators(
    ValidateIf(() => true, validationOptions),
    Validate(AudioOrVideoUrlRequiredConstraint, validationOptions),
  );
}

/**
 * Custom validation for update: when both media fields appear in the JSON body, at least one must be non-empty.
 * Place on `videoUrl` together with `@IsOptional()`, `@IsString()`, `@MaxLength()`.
 */
export function RequireAudioOrVideoUrlWhenBothSent(validationOptions?: ValidationOptions) {
  return applyDecorators(
    ValidateIf(
      (o: Record<string, unknown>) =>
        Object.prototype.hasOwnProperty.call(o, 'audioUrl') &&
        Object.prototype.hasOwnProperty.call(o, 'videoUrl'),
      validationOptions,
    ),
    Validate(AudioOrVideoUrlUpdatePairConstraint, validationOptions),
  );
}
