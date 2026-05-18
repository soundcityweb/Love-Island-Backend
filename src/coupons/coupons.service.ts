import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, DiscountType } from '../entities/coupon.entity';

export interface ValidateCouponResult {
  couponId: string;
  code: string;
  discountType: DiscountType;
  /** Resolved discount amount in the order's currency. */
  discountAmount: number;
  /** Original value (percentage or flat). */
  discountValue: number;
}

export interface CreateCouponPayload {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number | null;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface UpdateCouponPayload {
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  minOrderAmount?: number | null;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
  ) {}

  /**
   * Validates a coupon code against an order subtotal.
   * Returns resolved discount amount — does NOT increment usedCount (that
   * happens inside the order creation transaction).
   */
  async validate(code: string, orderSubtotal: number): Promise<ValidateCouponResult> {
    const coupon = await this.couponRepo.findOne({
      where: { code: code.toUpperCase(), isActive: true },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon code not found or no longer active.');
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('This coupon has expired.');
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('This coupon has reached its usage limit.');
    }
    if (coupon.minOrderAmount !== null && orderSubtotal < parseFloat(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `A minimum order of ${coupon.minOrderAmount} is required to use this coupon.`,
      );
    }

    const discountValue = parseFloat(coupon.discountValue);
    let discountAmount: number;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discountAmount = parseFloat(((orderSubtotal * discountValue) / 100).toFixed(2));
    } else {
      discountAmount = Math.min(discountValue, orderSubtotal);
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountAmount,
      discountValue,
    };
  }

  /** Increment usedCount atomically — called inside order creation. */
  async incrementUsedCount(couponCode: string): Promise<void> {
    await this.couponRepo
      .createQueryBuilder()
      .update(Coupon)
      .set({ usedCount: () => 'used_count + 1' })
      .where('code = :code', { code: couponCode })
      .execute();
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async findAll(): Promise<Coupon[]> {
    return this.couponRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(payload: CreateCouponPayload): Promise<Coupon> {
    const code = payload.code.toUpperCase().trim();
    const existing = await this.couponRepo.findOne({ where: { code } });
    if (existing) throw new ConflictException(`Coupon code "${code}" already exists.`);

    const coupon = this.couponRepo.create({
      code,
      discountType: payload.discountType,
      discountValue: payload.discountValue.toFixed(2),
      minOrderAmount: payload.minOrderAmount != null ? payload.minOrderAmount.toFixed(2) : null,
      maxUses: payload.maxUses ?? null,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      isActive: payload.isActive ?? true,
    });
    return this.couponRepo.save(coupon);
  }

  async update(id: string, payload: UpdateCouponPayload): Promise<Coupon> {
    const coupon = await this.findOneOrFail(id);

    if (payload.code !== undefined) coupon.code = payload.code.toUpperCase().trim();
    if (payload.discountType !== undefined) coupon.discountType = payload.discountType;
    if (payload.discountValue !== undefined) coupon.discountValue = payload.discountValue.toFixed(2);
    if ('minOrderAmount' in payload) {
      coupon.minOrderAmount = payload.minOrderAmount != null ? payload.minOrderAmount.toFixed(2) : null;
    }
    if ('maxUses' in payload) coupon.maxUses = payload.maxUses ?? null;
    if ('expiresAt' in payload) coupon.expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
    if (payload.isActive !== undefined) coupon.isActive = payload.isActive;

    return this.couponRepo.save(coupon);
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const coupon = await this.findOneOrFail(id);
    await this.couponRepo.remove(coupon);
    return { deleted: true, id };
  }

  private async findOneOrFail(id: string): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException(`Coupon "${id}" not found.`);
    return coupon;
  }
}
