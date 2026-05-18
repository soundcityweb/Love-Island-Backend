import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrossLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'cross link label is required.' })
  @MaxLength(200)
  label: string;

  @IsString()
  @IsNotEmpty({ message: 'cross link url is required.' })
  @MaxLength(2048)
  url: string;
}
