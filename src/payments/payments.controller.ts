import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRequest = any;

/**
 * Paystack references are alphanumeric strings, typically 16–32 characters.
 * We accept up to 100 characters to allow for custom prefixed references.
 */
const REFERENCE_REGEX = /^[a-zA-Z0-9_-]{6,100}$/;

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /api/payments/webhook
   *
   * Receives Paystack event notifications. Open to the public — authenticity is
   * verified via the x-paystack-signature HMAC-SHA512 header.
   * Always returns 200 so Paystack does not retry.
   * Throttle is skipped: Paystack servers call this from many IPs.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async webhook(
    @Req() req: RawRequest,
  ): Promise<{ received: boolean }> {
    const typedReq = req as RawBodyRequest<Request>;
    const signature =
      (typedReq.headers['x-paystack-signature'] as string | undefined) ?? '';
    const rawBody = (typedReq.rawBody as Buffer | undefined)?.toString('utf8') ?? '';
    await this.paymentsService.handleWebhook(rawBody, signature);
    return { received: true };
  }

  /**
   * GET /api/payments/verify/:reference
   *
   * Called by the frontend callback page to confirm a Paystack transaction.
   * Returns the Paystack status and the associated order details.
   */
  @Get('verify/:reference')
  async verify(
    @Param('reference') reference: string,
  ) {
    if (!REFERENCE_REGEX.test(reference)) {
      throw new BadRequestException(
        'Invalid payment reference format. Expected 6–100 alphanumeric characters.',
      );
    }
    return this.paymentsService.verify(reference);
  }
}
