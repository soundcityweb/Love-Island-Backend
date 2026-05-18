import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FLAT = 'flat',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({
    type: 'enum',
    enum: DiscountType,
    enumName: 'discount_type_enum',
  })
  discountType: DiscountType;

  @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2 })
  discountValue: string;

  @Column({ name: 'min_order_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, default: null })
  minOrderAmount: string | null;

  @Column({ name: 'max_uses', type: 'int', nullable: true, default: null })
  maxUses: number | null;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true, default: null })
  expiresAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
