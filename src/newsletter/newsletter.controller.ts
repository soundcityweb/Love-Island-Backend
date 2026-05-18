import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { NewsletterService } from './newsletter.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';

/** Next proxy sends Accept: application/json; browsers opening the API URL directly do not. */
function wantsJsonResponse(req: Request): boolean {
  return (req.headers.accept ?? '').includes('application/json');
}

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  /** Stricter than global 60/min — reduces abuse of public subscribe. */
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletterService.subscribe(dto.email);
  }

  /**
   * Server-to-server (Next route handler): returns JSON.
   * Browser hitting the API host directly (e.g. /api proxied to Nest): 302 to FRONTEND_URL/news.
   */
  @Get('unsubscribe')
  @SkipThrottle()
  async unsubscribe(
    @Query('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const base = this.newsletterService.getPublicSiteBase();

    if (!token?.trim()) {
      if (!wantsJsonResponse(req)) {
        return res.redirect(302, `${base}/news?unsubscribe_error=1`);
      }
      throw new BadRequestException('Missing token.');
    }

    try {
      await this.newsletterService.unsubscribeByToken(token.trim());
      if (!wantsJsonResponse(req)) {
        return res.redirect(302, `${base}/news?unsubscribed=1`);
      }
      return res.status(HttpStatus.OK).json({ ok: true });
    } catch (err) {
      if (!wantsJsonResponse(req)) {
        return res.redirect(302, `${base}/news?unsubscribe_error=1`);
      }
      throw err;
    }
  }
}
