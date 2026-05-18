import { IsEnum } from 'class-validator';
import { ContactMessageStatus } from '../../entities/contact-message.entity';

export class UpdateContactStatusDto {
  @IsEnum(ContactMessageStatus)
  status!: ContactMessageStatus;
}
