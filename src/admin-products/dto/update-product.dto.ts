import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductImageDto } from './product-image.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** Explicit slug override — auto-regenerated from name when name changes and slug is omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsPositive({ message: 'basePrice must be a positive number.' })
  basePrice?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'currency must be a 3-letter ISO code.' })
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'stock cannot be negative.' })
  stock?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'lowStockThreshold must be at least 1.' })
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * When provided, fully replaces the product's image list.
   * Pass an empty array to remove all images.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];
}
