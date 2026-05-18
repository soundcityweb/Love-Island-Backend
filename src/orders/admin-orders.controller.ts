import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * GET /api/admin/orders
   *
   * Returns a paginated list of order summaries for the admin dashboard.
   * Supports optional filtering by status.
   *
   * Query params:
   *   page    — page number, default 1
   *   limit   — items per page, default 20, max 100
   *   status  — filter by order status (pending | paid | failed | shipped | cancelled)
   */
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.ordersService.findAllAdmin(query);
  }

  /**
   * GET /api/admin/orders/:orderNumber
   *
   * Returns full order detail including customer PII and shipping address.
   * Admin-only — not exposed on the public orders endpoint.
   */
  @Get(':orderNumber')
  findOne(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.findOneForAdmin(orderNumber);
  }

  /**
   * PATCH /api/admin/orders/:orderNumber/ship
   *
   * Convenience alias — marks a PAID order as SHIPPED.
   * Rejects with 409 if the current status is not PAID.
   */
  @Patch(':orderNumber/ship')
  @HttpCode(HttpStatus.OK)
  ship(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.shipOrder(orderNumber);
  }

  /**
   * PATCH /api/admin/orders/:orderNumber/status
   *
   * General-purpose status transition.
   * Accepts any valid OrderStatus value.
   * Sets shipped_at when transitioning to SHIPPED; clears it otherwise.
   * Uses a pessimistic write lock to prevent concurrent transitions.
   */
  @Patch(':orderNumber/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(orderNumber, dto.status);
  }
}
