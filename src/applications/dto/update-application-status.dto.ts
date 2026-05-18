import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../../entities/application-status.enum';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus, {
    message: 'Status must be one of: submitted, under_review, accepted, rejected',
  })
  status: ApplicationStatus;
}
