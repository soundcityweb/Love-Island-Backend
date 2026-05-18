import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_SECONDS = 3600;

export interface VerifiedPreviewPayload {
  eventId: string;
}

@Injectable()
export class VotingPreviewTokenService {
  constructor(private readonly config: ConfigService) {}

  private getSecret(): string {
    const secret =
      this.config.get<string>('VOTE_PREVIEW_SECRET') ||
      this.config.get<string>('ADMIN_API_KEY');
    if (!secret?.trim()) {
      throw new Error(
        'VOTE_PREVIEW_SECRET or ADMIN_API_KEY must be set for voting preview.',
      );
    }
    return secret;
  }

  /**
   * Signed token: base64url(JSON { sub: eventId, exp: unixSeconds }).base64url(hmac)
   */
  createToken(
    eventId: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): { token: string; expiresAt: string } {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = Buffer.from(
      JSON.stringify({ sub: eventId, exp }),
      'utf8',
    ).toString('base64url');
    const sig = createHmac('sha256', this.getSecret())
      .update(payload)
      .digest('base64url');
    return {
      token: `${payload}.${sig}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  verify(token: string): VerifiedPreviewPayload | null {
    try {
      const dot = token.indexOf('.');
      if (dot <= 0) return null;
      const payloadB64 = token.slice(0, dot);
      const sig = token.slice(dot + 1);
      if (!payloadB64 || !sig) return null;

      const expectedSig = createHmac('sha256', this.getSecret())
        .update(payloadB64)
        .digest('base64url');

      const a = Buffer.from(sig, 'utf8');
      const b = Buffer.from(expectedSig, 'utf8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

      const json = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8'),
      ) as { sub?: unknown; exp?: unknown };
      if (typeof json.sub !== 'string' || typeof json.exp !== 'number') {
        return null;
      }
      if (json.exp < Math.floor(Date.now() / 1000)) return null;
      return { eventId: json.sub };
    } catch {
      return null;
    }
  }
}
