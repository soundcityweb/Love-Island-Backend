import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductImageDto } from './product-image.dto';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'slug must contain only lowercase letters, numbers and hyphens (e.g. my-product)';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required.' })
  @MaxLength(255)
  name: string;

  /**
   * Optional explicit slug. If omitted the service auto-generates one from name.
   * Must be URL-safe (lowercase, hyphens only).
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Price in minor/major units of the currency, e.g. 15000 for ₦15,000. */
  @IsNumber({}, { message: 'basePrice must be a number.' })
  @IsPositive({ message: 'basePrice must be a positive number.' })
  basePrice: number;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];
}
