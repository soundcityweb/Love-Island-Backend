import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Body for POST /admin/competitions/:id/winners
 *
 * auto   — server picks top-N by score (quiz/prediction) or random (poll/upload)
 * manual — admin supplies an ordered list; index 0 = rank 1
 */
export class SelectWinnersDto {
  @IsEnum(['auto', 'manual'])
  mode: 'auto' | 'manual';

  /**
   * Required when mode = "manual".
   * Ordered array of userId UUIDs — first entry becomes rank 1.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  userIds?: string[];

  /**
   * Optional when mode = "auto".
   * Overrides the competition's configured winnerCount for this run.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;
}
