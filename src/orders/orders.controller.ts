import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /api/orders
   *
   * Creates a new PENDING order for one or more cart items.
   * Validates stock, locks all product rows, computes totals server-side,
   * and returns payment initiation data.
   *
   * Stricter rate limit (5 per minute) to prevent abuse and duplicate orders.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  /**
   * GET /api/orders/:orderNumber
   *
   * Returns order status and line items for the checkout confirmation page.
   * Customer name is intentionally omitted from this unauthenticated response
   * to avoid PII enumeration via order number brute-forcing.
   */
  @Get(':orderNumber')
  async findOne(@Param('orderNumber') orderNumber: string) {
    const {
      customerFirstName: _fn,
      customerLastName: _ln,
      ...publicData
    } = await this.ordersService.findByOrderNumber(orderNumber);
    return publicData;
  }
}
