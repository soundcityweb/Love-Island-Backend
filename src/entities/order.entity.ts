import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from './order-status.enum';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';

@Entity('orders')
@Index(['orderNumber'], { unique: true })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number', type: 'varchar', unique: true })
  orderNumber: string;

  @Column({ name: 'customer_first_name', type: 'varchar' })
  customerFirstName: string;

  @Column({ name: 'customer_last_name', type: 'varchar' })
  customerLastName: string;

  @Column({ name: 'customer_email', type: 'varchar' })
  customerEmail: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 32, nullable: true })
  customerPhone: string | null;

  @Column({ name: 'shipping_address', type: 'varchar' })
  shippingAddress: string;

  @Column({ name: 'shipping_city', type: 'varchar' })
  shippingCity: string;

  @Column({ name: 'shipping_state', type: 'varchar' })
  shippingState: string;

  @Column({ name: 'subtotal_amount', type: 'decimal', precision: 12, scale: 2 })
  subtotalAmount: string;

  @Column({ name: 'shipping_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingAmount: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status_enum',
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'coupon_code', type: 'varchar', length: 64, nullable: true, default: null })
  couponCode: string | null;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, default: null })
  discountAmount: string | null;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true, default: null })
  shippedAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];
}
