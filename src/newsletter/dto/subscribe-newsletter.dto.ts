import { IsEmail, MaxLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @MaxLength(320)
  email: string;
}
