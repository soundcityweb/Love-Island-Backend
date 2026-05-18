import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContactSubject } from '../../entities/contact-message.entity';

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsEnum(ContactSubject)
  subject!: ContactSubject;

  @IsString()
  @MinLength(20)
  @MaxLength(10_000)
  message!: string;

  /** Honeypot — must stay empty (validated in service). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @Transform(({ value }) => value === true || value === 'true' || value === 'on' || value === '1')
  @IsBoolean()
  privacyConsent!: boolean;
}
