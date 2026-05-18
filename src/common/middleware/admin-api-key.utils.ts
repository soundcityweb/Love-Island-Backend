import { UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

export const ADMIN_KEY_HEADER = 'x-admin-key';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Ensures the request carries a valid admin API key (header vs ADMIN_API_KEY).
 * Uses constant-time comparison on the key material.
 */
export function requireAdminApiKey(req: Request): void {
  const key = req.headers[ADMIN_KEY_HEADER];
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    throw new UnauthorizedException('Admin API is not configured.');
  }
  if (!key || !safeCompare(String(key), expected)) {
    throw new UnauthorizedException('Invalid or missing admin key.');
  }
}
