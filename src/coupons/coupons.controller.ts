import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNumber, IsPositive, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { CouponsService } from './coupons.service';

class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @IsNumber()
  @IsPositive()
  orderSubtotal: number;
}

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  /**
   * POST /api/coupons/validate
   * Validates a coupon code and returns the resolved discount amount.
   * Does not consume the coupon (usedCount is incremented during order creation).
   *
   * Stricter rate limit (10 per minute) to prevent brute-force code guessing.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto.code, dto.orderSubtotal);
  }
}
