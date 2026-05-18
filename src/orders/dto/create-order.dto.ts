import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsUUID('4', { message: 'productId must be a valid UUID.' })
  productId: string;

  @IsInt({ message: 'quantity must be an integer.' })
  @Min(1, { message: 'quantity must be at least 1.' })
  @Max(10, { message: 'quantity cannot exceed 10.' })
  quantity: number;
}

export class CreateOrderDto {
  @IsArray({ message: 'items must be an array.' })
  @ArrayMinSize(1, { message: 'At least one item is required.' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsString()
  @IsNotEmpty({ message: 'customerFirstName is required.' })
  customerFirstName: string;

  @IsString()
  @IsNotEmpty({ message: 'customerLastName is required.' })
  customerLastName: string;

  @IsEmail({}, { message: 'customerEmail must be a valid email address.' })
  customerEmail: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+\d][\d\s\-()\\.]{6,29}$/, {
    message: 'customerPhone must be a valid phone number.',
  })
  customerPhone?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'shippingAddress is required.' })
  shippingAddress: string;

  @IsString()
  @IsNotEmpty({ message: 'shippingCity is required.' })
  shippingCity: string;

  @IsString()
  @IsNotEmpty({ message: 'shippingState is required.' })
  shippingState: string;

  /** Optional promo/coupon code to apply to the order. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  couponCode?: string;
}
