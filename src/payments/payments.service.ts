import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../entities/order-status.enum';
import { Product } from '../entities/product.entity';
import { EmailService } from '../common/services/email.service';

const PAYSTACK_BASE = 'https://api.paystack.co';

// ── Public interfaces ──────────────────────────────────────────────────────────

export interface InitiatePaymentParams {
  orderId: string;
  orderNumber: string;
  /** Total amount in the order's native currency (NGN). */
  amount: number;
  currency: string;
  email: string;
  /** Frontend URL Paystack redirects to after the user completes/abandons payment. */
  callbackUrl: string;
}

export interface InitiatePaymentResult {
  paymentUrl: string;
  reference: string;
}

export interface VerifyPaymentResult {
  /**
   * Paystack transaction status:
   * 'success' | 'failed' | 'abandoned' | 'pending' | 'error'
   */
  status: string;
  orderId?: string;
  orderNumber?: string;
}

// ── Paystack API shapes ────────────────────────────────────────────────────────

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string;
    channel?: string;
    customer?: { email: string; customer_code: string };
    metadata?: { order_id?: string; order_number?: string };
  };
}

interface PaystackWebhookEvent {
  event: string;
  data: {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paid_at?: string;
    channel?: string;
    customer?: { email: string; customer_code?: string };
    authorization?: {
      authorization_code?: string;
      last4?: string;
      bank?: string;
      card_type?: string;
    };
    metadata?: { order_id?: string; order_number?: string };
    [key: string]: unknown;
  };
}

// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly secretKey: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY ?? '';
    if (!this.secretKey) {
      this.logger.warn(
        'PAYSTACK_SECRET_KEY is not configured — payment initiation will fail',
      );
    }
  }

  // ── Initiate ───────────────────────────────────────────────────────────────

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    // Guard: reject duplicate payment initiation for orders already in a terminal state
    const existingOrder = await this.dataSource
      .getRepository(Order)
      .findOne({ where: { id: params.orderId } });

    if (existingOrder) {
      const terminalStatuses: string[] = [
        OrderStatus.PAID,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
      ];
      if (terminalStatuses.includes(existingOrder.status)) {
        throw new ConflictException(
          `Order "${params.orderNumber}" has already been paid. Duplicate payment initiation rejected.`,
        );
      }
    }

    const amountKobo = Math.round(params.amount * 100);

    let res: Response;
    try {
      res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          amount: amountKobo,
          currency: params.currency,
          reference: params.orderNumber,
          callback_url: params.callbackUrl,
          metadata: {
            order_id: params.orderId,
            order_number: params.orderNumber,
          },
        }),
      });
    } catch (err) {
      this.logger.error('Failed to reach Paystack API', err);
      throw new ServiceUnavailableException(
        'Payment gateway is unreachable. Please try again later.',
      );
    }

    const body = (await res.json().catch(() => ({}))) as PaystackInitResponse;

    if (!res.ok || !body.status || !body.data?.authorization_url) {
      this.logger.error(
        `Paystack init failed (HTTP ${res.status}): ${body.message ?? JSON.stringify(body)}`,
      );
      throw new ServiceUnavailableException(
        'Could not create a payment session. Please try again.',
      );
    }

    const paymentRepo = this.dataSource.getRepository(Payment);
    await paymentRepo.save(
      paymentRepo.create({
        orderId: params.orderId,
        provider: 'paystack',
        amount: params.amount.toFixed(2),
        currency: params.currency,
        gatewayReference: body.data.reference,
        status: 'INITIATED',
        payloadJson: {
          authorization_url: body.data.authorization_url,
          access_code: body.data.access_code,
        },
      }),
    );

    this.logger.log(
      `Payment initiated for order ${params.orderNumber} (ref: ${body.data.reference})`,
    );

    return {
      paymentUrl: body.data.authorization_url,
      reference: body.data.reference,
    };
  }

  // ── Webhook ────────────────────────────────────────────────────────────────

  /**
   * Receives Paystack webhook events.
   *
   * Security:   HMAC-SHA512 signature verified before any processing.
   * Idempotency: each handler acquires a pessimistic write lock on the Payment
   *              row and bails early if already in a terminal state.
   * Durability:  all mutations (payment status, order status, stock) run inside
   *              a single DB transaction; the full raw event payload is merged
   *              into payload_json.
   */
  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    // ── 1. Verify signature ────────────────────────────────────────────────
    if (!this.verifySignature(rawBody, signature)) {
      this.logger.warn('Webhook rejected: invalid HMAC-SHA512 signature');
      return;
    }

    // ── 2. Parse event ─────────────────────────────────────────────────────
    let event: PaystackWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PaystackWebhookEvent;
    } catch {
      this.logger.warn('Webhook rejected: could not parse JSON body');
      return;
    }

    if (!event?.event || !event?.data?.reference) {
      this.logger.warn(
        `Webhook rejected: missing event type or reference (event: ${JSON.stringify(event?.event)})`,
      );
      return;
    }

    this.logger.log(
      `Paystack webhook "${event.event}" ref="${event.data.reference}"`,
    );

    // ── 3. Route to the appropriate transactional handler ──────────────────
    if (event.event === 'charge.success') {
      await this.applySuccess(event.data.reference, event.data);
    } else if (['charge.failed', 'charge.reversed'].includes(event.event)) {
      await this.applyFailure(event.data.reference, event.data);
    }
    // All other event types (e.g. transfer.*) are acknowledged but not acted on.
  }

  // ── Verify (frontend callback) ─────────────────────────────────────────────

  async verify(reference: string): Promise<VerifyPaymentResult> {
    let res: Response;
    try {
      res = await fetch(
        `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${this.secretKey}` } },
      );
    } catch (err) {
      this.logger.error('Failed to reach Paystack verify API', err);
      return { status: 'error' };
    }

    const body = (await res.json().catch(() => ({}))) as PaystackVerifyResponse;

    if (!res.ok || !body.status || !body.data) {
      this.logger.warn(
        `Paystack verify non-success (HTTP ${res.status}): ${body.message ?? ''}`,
      );
      return { status: 'error' };
    }

    const paystackStatus = body.data.status;
    const meta = body.data.metadata;

    // Sync DB state with the authoritative Paystack status.
    // Pass null payload — the webhook is the authoritative payload store;
    // we only update the status here without overwriting existing payload_json.
    try {
      if (paystackStatus === 'success') {
        await this.applySuccess(reference, null);
      } else if (['failed', 'abandoned'].includes(paystackStatus)) {
        await this.applyFailure(reference, null);
      }
    } catch (err) {
      this.logger.error(`Failed to sync status for ref "${reference}"`, err);
    }

    return {
      status: paystackStatus,
      orderId: meta?.order_id,
      orderNumber: meta?.order_number,
    };
  }

  // ── Compensate: cancel order when payment init fails ──────────────────────

  async cancelOrderAndRestoreStock(
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.getRepository(Order).update(orderId, {
        status: OrderStatus.FAILED,
      });
      await this.restoreStockInTransaction(qr, items);
      await qr.commitTransaction();
      this.logger.log(
        `Order ${orderId} cancelled and stock restored (payment init failed)`,
      );
    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(
        `Failed to cancel order ${orderId} after payment init failure`,
        err,
      );
    } finally {
      await qr.release();
    }
  }

  // ── Transactional: mark order PAID ────────────────────────────────────────

  /**
   * @param payload  Full Paystack event data to merge into payload_json.
   *                 Pass null when called from verify (no new payload to store).
   */
  private async applySuccess(
    reference: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Pessimistic write lock prevents concurrent processing of the same event
      const payment = await qr.manager
        .getRepository(Payment)
        .createQueryBuilder('p')
        .where('p.gatewayReference = :ref', { ref: reference })
        .setLock('pessimistic_write')
        .getOne();

      if (!payment) {
        this.logger.warn(`applySuccess: no payment for ref "${reference}"`);
        await qr.rollbackTransaction();
        return;
      }

      // Idempotency guard — already in a terminal state
      if (payment.status === 'PAID') {
        this.logger.debug(`applySuccess: already PAID (ref "${reference}") — skipping`);
        await qr.rollbackTransaction();
        return;
      }

      // Update payment record
      const updatedPayloadJson = this.mergePayload(payment.payloadJson, payload);
      await qr.manager.getRepository(Payment).update(payment.id, {
        status: 'PAID',
        payloadJson: updatedPayloadJson as any,
      });

      // Update order status
      await qr.manager
        .getRepository(Order)
        .update(payment.orderId, { status: OrderStatus.PAID });

      // Fetch the order for email details (within same transaction)
      const order = await qr.manager
        .getRepository(Order)
        .findOne({ where: { id: payment.orderId } });

      await qr.commitTransaction();

      this.logger.log(
        `Payment ${payment.id} → PAID | Order ${payment.orderId} → PAID (ref: "${reference}")`,
      );

      // Send payment success email (non-blocking).
      // Load order items + images outside the transaction before sending.
      if (order) {
        this.dataSource
          .getRepository(Order)
          .createQueryBuilder('o')
          .leftJoinAndSelect('o.items', 'items')
          .leftJoinAndSelect('items.product', 'product')
          .leftJoinAndSelect('product.images', 'productImages')
          .where('o.id = :id', { id: order.id })
          .getOne()
          .then((orderWithItems) => {
            const items = (orderWithItems?.items ?? []).map((item) => {
              const sorted = (item.product?.images ?? [])
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder);
              return {
                productName: item.product?.name ?? '—',
                quantity: item.quantity,
                priceSnapshot: item.priceSnapshot,
                productImage: sorted[0]?.url ?? null,
              };
            });
            return this.emailService.sendPaymentSuccessEmail(order.customerEmail, {
              orderNumber: order.orderNumber,
              customerFirstName: order.customerFirstName,
              items,
              subtotalAmount: orderWithItems?.subtotalAmount ?? order.totalAmount,
              couponCode: orderWithItems?.couponCode ?? null,
              discountAmount: orderWithItems?.discountAmount ?? null,
              totalAmount: order.totalAmount,
              currency: order.currency,
            });
          })
          .catch((err) => this.logger.error('Payment success email failed', err));
      }
    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(`applySuccess failed for ref "${reference}"`, err);
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Transactional: mark order FAILED + restore stock ─────────────────────

  /**
   * @param payload  Full Paystack event data to merge into payload_json.
   *                 Pass null when called from verify (no new payload to store).
   */
  private async applyFailure(
    reference: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const payment = await qr.manager
        .getRepository(Payment)
        .createQueryBuilder('p')
        .where('p.gatewayReference = :ref', { ref: reference })
        .setLock('pessimistic_write')
        .getOne();

      if (!payment) {
        this.logger.warn(`applyFailure: no payment for ref "${reference}"`);
        await qr.rollbackTransaction();
        return;
      }

      // Idempotency guard
      if (payment.status === 'FAILED') {
        this.logger.debug(`applyFailure: already FAILED (ref "${reference}") — skipping`);
        await qr.rollbackTransaction();
        return;
      }

      const order = await qr.manager
        .getRepository(Order)
        .createQueryBuilder('o')
        .where('o.id = :id', { id: payment.orderId })
        .leftJoinAndSelect('o.items', 'items')
        .setLock('pessimistic_write')
        .getOne();

      if (order && order.status === OrderStatus.PENDING) {
        await this.restoreStockInTransaction(qr, order.items);
        await qr.manager
          .getRepository(Order)
          .update(order.id, { status: OrderStatus.FAILED });
      }

      const updatedPayloadJson = this.mergePayload(payment.payloadJson, payload);
      await qr.manager.getRepository(Payment).update(payment.id, {
        status: 'FAILED',
        payloadJson: updatedPayloadJson as any,
      });

      await qr.commitTransaction();

      this.logger.log(
        `Payment ${payment.id} → FAILED | Order ${payment.orderId} → FAILED, stock restored (ref: "${reference}")`,
      );
    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(`applyFailure failed for ref "${reference}"`, err);
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Constant-time HMAC-SHA512 comparison to prevent timing attacks.
   */
  private verifySignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    try {
      const expected = createHmac('sha512', this.secretKey)
        .update(rawBody)
        .digest('hex');
      // timingSafeEqual requires same-length Buffers
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(signature, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Merges a new Paystack payload into the existing payload_json.
   * Only appends the webhook data — never overwrites the init data.
   */
  private mergePayload(
    existing: Record<string, unknown> | null,
    incoming: Record<string, unknown> | null,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = existing ?? {};
    if (!incoming) return base;
    return {
      ...base,
      webhook_event: incoming,
      webhook_processed_at: new Date().toISOString(),
    };
  }

  private async restoreStockInTransaction(
    qr: QueryRunner,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void> {
    for (const item of items) {
      await qr.manager
        .getRepository(Product)
        .createQueryBuilder()
        .update(Product)
        .set({ stock: () => 'stock + :qty' })
        .setParameter('qty', item.quantity)
        .where('id = :id', { id: item.productId })
        .execute();
    }
  }
}

export { OrderItem };
