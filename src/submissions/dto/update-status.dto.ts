import { IsEnum } from 'class-validator';
import { SUBMISSION_STATUSES } from './list-submissions.dto';
import type { SubmissionStatus } from './list-submissions.dto';

/**
 * Body for PATCH /admin/submissions/:id/status
 */
export class UpdateStatusDto {
  @IsEnum(SUBMISSION_STATUSES)
  status: SubmissionStatus;
}
