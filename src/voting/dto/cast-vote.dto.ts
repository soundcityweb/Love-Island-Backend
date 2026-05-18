import { IsUUID } from 'class-validator';

/**
 * Body for casting a vote. Business rules (who can vote, limits, period) are enforced server-side.
 * Frontend only sends the chosen islander; fingerprint is derived server-side.
 */
export class CastVoteDto {
  @IsUUID('4', { message: 'islanderId must be a valid UUID' })
  islanderId: string;
}
