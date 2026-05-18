import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCompetitionDto } from './create-competition.dto';
import { CompetitionStatus } from '../../entities/competition-status.enum';

/**
 * All fields from CreateCompetitionDto become optional.
 * Also includes a dedicated `status` field for explicit status transitions.
 */
export class UpdateCompetitionDto extends PartialType(CreateCompetitionDto) {}

/**
 * Thin DTO used by the dedicated PATCH /status endpoint.
 * Keeps status transitions explicit and auditable.
 */
export class UpdateCompetitionStatusDto {
  @IsEnum(CompetitionStatus)
  status: CompetitionStatus;

  @IsOptional()
  // Reserved for future audit/reason fields
  reason?: string;
}
