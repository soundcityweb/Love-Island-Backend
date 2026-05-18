import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service';

/** Generic message returned for any guard failure; do not expose fraud reason */
const GENERIC_MESSAGE = 'Unable to process request.';

const SESSION_ID_HEADER = 'x-session-id';
const SESSION_ID_MIN_LENGTH = 1;
const SESSION_ID_MAX_LENGTH = 512;
const IP_RATE_LIMIT_WINDOW_SECONDS = 60;
const IP_RATE_LIMIT_MAX_PER_WINDOW = 20;

@Injectable()
export class VotingGuard implements CanActivate {
  /** In-memory fallback when Redis is unavailable: hashedIp -> timestamps in window */
  private readonly ipWindowMap = new Map<string, number[]>();

  constructor(private readonly redis: RedisService) {}

  private hashIp(ip: string): string {
    return createHash('sha256').update(ip.trim() || 'unknown').digest('hex');
  }

  private validateSessionId(sessionId: string): boolean {
    if (typeof sessionId !== 'string') return false;
    const trimmed = sessionId.trim();
    return trimmed.length >= SESSION_ID_MIN_LENGTH && trimmed.length <= SESSION_ID_MAX_LENGTH;
  }

  private async checkRateLimitByHashedIp(hashedIp: string): Promise<void> {
    if (this.redis.isAvailable()) {
      const count = await this.redis.incrementIpThrottle(hashedIp, IP_RATE_LIMIT_WINDOW_SECONDS);
      if (count != null && count > IP_RATE_LIMIT_MAX_PER_WINDOW) {
        throw new ForbiddenException(GENERIC_MESSAGE);
      }
      return;
    }
    const now = Date.now();
    const windowMs = IP_RATE_LIMIT_WINDOW_SECONDS * 1000;
    let timestamps = this.ipWindowMap.get(hashedIp) ?? [];
    timestamps = timestamps.filter((t) => now - t < windowMs);
    if (timestamps.length >= IP_RATE_LIMIT_MAX_PER_WINDOW) {
      throw new ForbiddenException(GENERIC_MESSAGE);
    }
    timestamps.push(now);
    this.ipWindowMap.set(hashedIp, timestamps);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const sessionIdRaw = request.headers[SESSION_ID_HEADER];
    const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : '';
    if (!this.validateSessionId(sessionId)) {
      throw new ForbiddenException(GENERIC_MESSAGE);
    }

    const ip = (request.ip ?? request.socket?.remoteAddress ?? 'unknown').trim();
    const hashedIp = this.hashIp(ip);

    await this.checkRateLimitByHashedIp(hashedIp);

    request.votingSessionId = sessionId;
    request.votingHashedIp = hashedIp;
    return true;
  }
}
