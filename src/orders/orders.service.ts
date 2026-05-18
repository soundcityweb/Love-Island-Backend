import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../entities/order-status.enum';
import { Coupon } from '../entities/coupon.entity';
import { PaymentsService } from '../payments/payments.service';
import { EmailService } from '../common/services/email.service';
import { CouponsService } from '../coupons/coupons.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { AnalyticsEventEmitter } from '../analytics/analytics.events';

/** Paystack callback base: FRONTEND_URL, APP_FRONTEND_URL, or PUBLIC_APP_URL (no trailing slash). */
function frontendBaseUrlFromEnv(): string {
  const raw =
    process.env.FRONTEND_URL?.trim() ||
    process.env.APP_FRONTEND_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim();
  if (!raw) {
    throw new ServiceUnavailableException(
      'FRONTEND_URL is not configured — set it to your public site origin (no trailing slash) for Paystack checkout.',
    );
  }
  return raw.replace(/\/$/, '');
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string;
  currency: string;
  /** Paystack authorization URL — redirect the user here to complete payment. */
  paymentUrl: string;
}

export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string;
  currency: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  itemCount: number;
  createdAt: Date;
}

export interface PaginatedOrders {
  data: OrderSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderDetailResult {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string;
  couponCode: string | null;
  discountAmount: string | null;
  currency: string;
  createdAt: Date;
  customerFirstName: string;
  customerLastName: string;
  items: Array<{
    productId: string;
    productName: string;
    productSlug: string | null;
    productImage: string | null;
    priceSnapshot: string;
    quantity: number;
  }>;
}

export interface AdminOrderDetailResult extends OrderDetailResult {
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  subtotalAmount: string;
  shippedAt: Date | null;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
    private readonly analyticsEvents: AnalyticsEventEmitter,
    private readonly emailService: EmailService,
    private readonly couponsService: CouponsService,
  ) {}

  async create(dto: CreateOrderDto): Promise<CreateOrderResult> {
    // ── Phase 1: reserve stock and persist the order (DB transaction) ──────────
    const { savedOrder, resolvedItems } = await this.createOrderTransaction(dto);

    // Note: coupon usedCount increment happens inside createOrderTransaction

    // ── Phase 2: initiate payment with Paystack (outside DB transaction) ────────
    const callbackUrl = `${frontendBaseUrlFromEnv()}/shop/checkout/callback`;

    try {
      const payment = await this.paymentsService.initiate({
        orderId: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        amount: parseFloat(savedOrder.totalAmount),
        currency: savedOrder.currency,
        email: dto.customerEmail,
        callbackUrl,
      });

      this.analyticsEvents.emitOrderCreated({
        orderId: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        totalAmount: savedOrder.totalAmount,
        currency: savedOrder.currency,
        itemCount: resolvedItems.length,
        createdAt: savedOrder.createdAt,
      });

      // Send order confirmation email (non-blocking — failure must not affect the response).
      // Load product images first (separate query — images were not fetched in the transaction).
      const productIds = resolvedItems.map((i) => i.product.id);
      this.dataSource
        .getRepository(Product)
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.images', 'img')
        .where('p.id IN (:...ids)', { ids: productIds })
        .getMany()
        .then((prods) => {
          const imageMap = new Map(
            prods.map((p) => {
              const sorted = (p.images ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
              return [p.id, sorted[0]?.url ?? null] as [string, string | null];
            }),
          );
          return this.emailService.sendOrderConfirmationEmail(dto.customerEmail, {
            orderNumber: savedOrder.orderNumber,
            customerFirstName: dto.customerFirstName,
            items: resolvedItems.map((i) => ({
              productName: i.product.name,
              quantity: i.quantity,
              priceSnapshot: i.priceSnapshot.toFixed(2),
              productImage: imageMap.get(i.product.id) ?? null,
            })),
            subtotalAmount: savedOrder.subtotalAmount,
            couponCode: savedOrder.couponCode,
            discountAmount: savedOrder.discountAmount,
            totalAmount: savedOrder.totalAmount,
            currency: savedOrder.currency,
            shippingAddress: dto.shippingAddress,
            shippingCity: dto.shippingCity,
            shippingState: dto.shippingState,
          });
        })
        .catch((err) => this.logger.error('Order confirmation email failed', err));

      return {
        orderId: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        status: savedOrder.status,
        totalAmount: savedOrder.totalAmount,
        currency: savedOrder.currency,
        paymentUrl: payment.paymentUrl,
      };
    } catch (err) {
      // Payment gateway is down: compensate — restore stock and cancel order.
      await this.paymentsService.cancelOrderAndRestoreStock(
        savedOrder.id,
        resolvedItems.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      );

      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(
        'Payment gateway is currently unavailable. Please try again.',
      );
    }
  }

  async findAllAdmin(query: PaginationQueryDto): Promise<PaginatedOrders> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .loadRelationCountAndMap('o.itemCount', 'o.items')
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.where('o.status = :status', { status: query.status });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      data: orders.map((o) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        currency: o.currency,
        customerFirstName: o.customerFirstName,
        customerLastName: o.customerLastName,
        customerEmail: o.customerEmail,
        itemCount: (o as Order & { itemCount: number }).itemCount ?? 0,
        createdAt: o.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByOrderNumber(orderNumber: string): Promise<OrderDetailResult> {
    const order = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.images', 'productImages')
      .where('o.orderNumber = :orderNumber', { orderNumber })
      .getOne();

    if (!order) {
      throw new NotFoundException(`Order "${orderNumber}" not found.`);
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      couponCode: order.couponCode,
      discountAmount: order.discountAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      items: order.items.map((item) => {
        const sortedImages = (item.product?.images ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return {
          productId: item.productId,
          productName: item.product?.name ?? '—',
          productSlug: item.product?.slug ?? null,
          productImage: sortedImages[0]?.url ?? null,
          priceSnapshot: item.priceSnapshot,
          quantity: item.quantity,
        };
      }),
    };
  }

  async shipOrder(
    orderNumber: string,
  ): Promise<{ orderId: string; orderNumber: string; shippedAt: Date }> {
    const order = await this.dataSource
      .getRepository(Order)
      .findOne({ where: { orderNumber } });

    if (!order) {
      throw new NotFoundException(`Order "${orderNumber}" not found.`);
    }
    if (order.status !== OrderStatus.PAID) {
      throw new ConflictException(
        `Order cannot be shipped: current status is "${order.status}". Only PAID orders can be shipped.`,
      );
    }

    const result = await this.updateOrderStatus(
      orderNumber,
      OrderStatus.SHIPPED,
    );
    return {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      shippedAt: result.shippedAt as Date,
    };
  }

  async updateOrderStatus(
    orderNumber: string,
    newStatus: OrderStatus,
  ): Promise<{
    orderId: string;
    orderNumber: string;
    status: OrderStatus;
    shippedAt: Date | null;
  }> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const order = await qr.manager
        .getRepository(Order)
        .createQueryBuilder('o')
        .where('o.orderNumber = :orderNumber', { orderNumber })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new NotFoundException(`Order "${orderNumber}" not found.`);
      }

      if (order.status === newStatus) {
        await qr.rollbackTransaction();
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          shippedAt: order.shippedAt,
        };
      }

      // shipped_at is set when status becomes SHIPPED, cleared for all other statuses
      const shippedAt = newStatus === OrderStatus.SHIPPED ? new Date() : null;

      await qr.manager.getRepository(Order).update(order.id, {
        status: newStatus,
        shippedAt,
      });

      await qr.commitTransaction();

      // Send shipping notification email (non-blocking).
      // Load items + images outside the transaction before sending.
      if (newStatus === OrderStatus.SHIPPED) {
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
            return this.emailService.sendShippingUpdateEmail(order.customerEmail, {
              orderNumber: order.orderNumber,
              customerFirstName: order.customerFirstName,
              items,
              totalAmount: orderWithItems?.totalAmount ?? order.totalAmount,
              currency: order.currency,
            });
          })
          .catch((err) => this.logger.error('Shipping update email failed', err));
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: newStatus,
        shippedAt,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async findOneForAdmin(orderNumber: string): Promise<AdminOrderDetailResult> {
    const order = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.images', 'productImages')
      .where('o.orderNumber = :orderNumber', { orderNumber })
      .getOne();

    if (!order) {
      throw new NotFoundException(`Order "${orderNumber}" not found.`);
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      subtotalAmount: order.subtotalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      couponCode: order.couponCode,
      discountAmount: order.discountAmount,
      shippedAt: order.shippedAt,
      items: order.items.map((item) => {
        const sortedImages = (item.product?.images ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return {
          productId: item.productId,
          productName: item.product?.name ?? '—',
          productSlug: item.product?.slug ?? null,
          productImage: sortedImages[0]?.url ?? null,
          priceSnapshot: item.priceSnapshot,
          quantity: item.quantity,
        };
      }),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async createOrderTransaction(dto: CreateOrderDto): Promise<{
    savedOrder: Order;
    resolvedItems: Array<{ product: Product; quantity: number; priceSnapshot: number }>;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const productRepo = queryRunner.manager.getRepository(Product);

      const resolvedItems: Array<{
        product: Product;
        quantity: number;
        priceSnapshot: number;
      }> = [];

      // ── 1. Lock and validate every product ──
      for (const item of dto.items) {
        const product = await productRepo
          .createQueryBuilder('p')
          .where('p.id = :id', { id: item.productId })
          .setLock('pessimistic_write')
          .getOne();

        if (!product) {
          throw new NotFoundException(
            `Product with id "${item.productId}" not found.`,
          );
        }
        if (!product.isActive) {
          throw new BadRequestException(
            `"${product.name}" is no longer available.`,
          );
        }
        if (product.stock < item.quantity) {
          throw new ConflictException(
            product.stock === 0
              ? `"${product.name}" is out of stock.`
              : `Only ${product.stock} unit(s) of "${product.name}" available.`,
          );
        }

        resolvedItems.push({
          product,
          quantity: item.quantity,
          priceSnapshot: parseFloat(product.basePrice),
        });
      }

      // ── 2. Calculate total (server-side, never trust client prices) ──
      const subtotalAmount = resolvedItems.reduce(
        (sum, i) => sum + i.priceSnapshot * i.quantity,
        0,
      );
      const currency = resolvedItems[0].product.currency;

      // ── 2b. Validate and apply coupon if provided ──
      let discountAmount = 0;
      let couponCode: string | null = null;
      if (dto.couponCode) {
        const couponResult = await this.couponsService.validate(
          dto.couponCode,
          subtotalAmount,
        );
        discountAmount = couponResult.discountAmount;
        couponCode = couponResult.code;
        // Increment used_count inside this transaction
        await queryRunner.manager
          .getRepository(Coupon)
          .createQueryBuilder()
          .update()
          .set({ usedCount: () => 'used_count + 1' })
          .where('code = :code', { code: couponCode })
          .execute();
      }

      const totalAmount = Math.max(0, subtotalAmount - discountAmount);

      // ── 3. Create order (PENDING) ──
      const orderNumber = generateOrderNumber();
      const orderRepo = queryRunner.manager.getRepository(Order);
      const order = orderRepo.create({
        orderNumber,
        customerFirstName: dto.customerFirstName,
        customerLastName: dto.customerLastName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone ?? null,
        shippingAddress: dto.shippingAddress,
        shippingCity: dto.shippingCity,
        shippingState: dto.shippingState,
        subtotalAmount: subtotalAmount.toFixed(2),
        shippingAmount: '0.00',
        totalAmount: totalAmount.toFixed(2),
        couponCode,
        discountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : null,
        currency,
        status: OrderStatus.PENDING,
      });
      const savedOrder = await orderRepo.save(order);

      // ── 4. Create order items and decrement stock (reservation) ──
      const itemRepo = queryRunner.manager.getRepository(OrderItem);
      for (const { product, quantity, priceSnapshot } of resolvedItems) {
        await itemRepo.save(
          itemRepo.create({
            orderId: savedOrder.id,
            productId: product.id,
            priceSnapshot: priceSnapshot.toFixed(2),
            quantity,
          }),
        );

        await productRepo
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => 'stock - :qty' })
          .setParameter('qty', quantity)
          .where('id = :id', { id: product.id })
          .execute();
      }

      await queryRunner.commitTransaction();

      // Low-stock alerts fired after commit (non-blocking, outside transaction)
      for (const { product, quantity } of resolvedItems) {
        const newStock = product.stock - quantity;
        if (newStock >= 0 && newStock <= product.lowStockThreshold) {
          this.emailService
            .sendLowStockAlertEmail(product.name, newStock)
            .catch((err) => this.logger.error('Low stock alert email failed', err));
        }
      }

      return { savedOrder, resolvedItems };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a human-readable order number: LI-YYYYMMDD-XXXXXX
 * e.g. LI-20260211-3F9A2B
 *
 * The suffix is 3 cryptographically random bytes encoded as 6 uppercase hex
 * characters (~16.7 M combinations), replacing the prior Math.random() suffix
 * (~1.68 M combinations) to reduce enumeration risk on the public order lookup.
 */
function generateOrderNumber(): string {
  const now = new Date();
  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `LI-${date}-${suffix}`;
}
