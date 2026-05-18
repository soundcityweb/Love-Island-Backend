import { EventEmitter } from 'events';

// ── Event name constants ────────────────────────────────────────────────────
export const ANALYTICS_APPLICATION_SUBMITTED = 'analytics.application.submitted';
export const ANALYTICS_VOTE_CAST = 'analytics.vote.cast';
export const ANALYTICS_ORDER_CREATED = 'analytics.order.created';
export const ANALYTICS_PAGE_VIEWED = 'analytics.page.viewed';

// ── Payload types ───────────────────────────────────────────────────────────
export interface ApplicationSubmittedPayload {
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
}

export interface VoteCastPayload {
  voteId: string;
  votingPeriodId: string;
  islanderId: string;
  createdAt: Date;
}

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  itemCount: number;
  createdAt: Date;
}

export interface PageViewedPayload {
  path: string;
  method: string;
  ip: string | undefined;
  userAgent: string | undefined;
  timestamp: Date;
}

/**
 * In-process analytics event bus built on Node's built-in EventEmitter.
 * Emits after key business actions are successfully persisted.
 *
 * Extend AnalyticsListener to forward events to Segment, Mixpanel, Amplitude,
 * a time-series DB, or any other provider — with zero coupling to the write path.
 */
export class AnalyticsEventEmitter extends EventEmitter {
  emitApplicationSubmitted(payload: ApplicationSubmittedPayload): void {
    this.emit(ANALYTICS_APPLICATION_SUBMITTED, payload);
  }

  emitVoteCast(payload: VoteCastPayload): void {
    this.emit(ANALYTICS_VOTE_CAST, payload);
  }

  emitOrderCreated(payload: OrderCreatedPayload): void {
    this.emit(ANALYTICS_ORDER_CREATED, payload);
  }

  emitPageViewed(payload: PageViewedPayload): void {
    this.emit(ANALYTICS_PAGE_VIEWED, payload);
  }
}
