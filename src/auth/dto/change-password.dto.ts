import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Current password is required.' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters.' })
  @MaxLength(128)
  @Matches(/^(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'New password must include at least one number and one special character.',
  })
  newPassword: string;

  @IsString()
  @MinLength(1, { message: 'Please confirm your new password.' })
  confirmNewPassword: string;
}
