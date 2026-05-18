import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ProductImageDto {
  @IsString()
  @IsNotEmpty({ message: 'Image URL is required.' })
  url: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
