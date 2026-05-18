import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sentByLabel?: string;
}
