import { Injectable, NestMiddleware } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AnalyticsEventEmitter } from './analytics.events';

/**
 * Paths whose prefix should NOT generate a page-view event.
 * - /api/admin/*  — internal dashboard calls
 * - /api/payments/webhook  — payment provider callbacks
 * - /uploads/*    — static file serving
 * - /health       — infra health checks
 */
const SKIP_PREFIXES = ['/api/admin', '/api/payments/webhook', '/uploads', '/health'];

/**
 * Returns a truncated SHA-256 hash of the IP address.
 * IP addresses are personal data under GDPR; hashing avoids storing raw IPs
 * while still allowing unique-visitor counting per analytics session.
 */
function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

@Injectable()
export class AnalyticsMiddleware implements NestMiddleware {
  constructor(private readonly analytics: AnalyticsEventEmitter) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const shouldTrack =
      req.method === 'GET' &&
      !SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix));

    if (shouldTrack) {
      this.analytics.emitPageViewed({
        path: req.path,
        method: req.method,
        ip: hashIp(req.ip),
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
      });
    }

    next();
  }
}
