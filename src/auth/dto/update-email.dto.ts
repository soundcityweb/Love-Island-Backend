import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateEmailDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(255)
  newEmail: string;

  @IsString()
  @MinLength(1, { message: 'Current password is required.' })
  currentPassword: string;
}
