import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('payments')
@Index(['orderId'])
@Index(['gatewayReference'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** Payment gateway name, e.g. "paystack". */
  @Column({ type: 'varchar', length: 32, default: 'paystack' })
  provider: string;

  /** Transaction amount in the order's currency (NGN). */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount: string | null;

  /** ISO 4217 currency code. */
  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  /** Reference returned by the payment gateway (Paystack transaction reference). */
  @Column({ name: 'gateway_reference', type: 'varchar', nullable: true })
  gatewayReference: string | null;

  /**
   * Internal payment status:
   * INITIATED → PAID | FAILED
   */
  @Column({ type: 'varchar', length: 64 })
  status: string;

  /** Raw payload from the gateway (authorization URL, webhook body, etc.). */
  @Column({ name: 'payload_json', type: 'jsonb', nullable: true })
  payloadJson: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
