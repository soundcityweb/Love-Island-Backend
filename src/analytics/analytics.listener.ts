import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AnalyticsEventEmitter,
  ANALYTICS_APPLICATION_SUBMITTED,
  ANALYTICS_VOTE_CAST,
  ANALYTICS_ORDER_CREATED,
  ANALYTICS_PAGE_VIEWED,
  ApplicationSubmittedPayload,
  VoteCastPayload,
  OrderCreatedPayload,
  PageViewedPayload,
} from './analytics.events';

/**
 * Listens to all analytics events and acts on them.
 *
 * Currently logs structured entries so events are observable in server logs.
 * To integrate a real analytics provider:
 *   1. Inject its client/SDK (HTTP service, Segment client, etc.) in the constructor.
 *   2. Replace or supplement the logger calls below with provider calls.
 *   3. Keep each handler non-blocking (fire-and-forget or use void promises).
 */
@Injectable()
export class AnalyticsListener implements OnModuleInit {
  private readonly logger = new Logger('Analytics');

  constructor(private readonly analytics: AnalyticsEventEmitter) {}

  onModuleInit(): void {
    this.analytics.on(
      ANALYTICS_APPLICATION_SUBMITTED,
      (payload: ApplicationSubmittedPayload) => {
        this.logger.log(
          `[application.submitted] id=${payload.applicationId} ` +
            `name="${payload.firstName} ${payload.lastName}" ` +
            `email=${payload.email} at=${payload.createdAt.toISOString()}`,
        );
        // TODO: forward to analytics provider, e.g.:
        // this.segment.track({ event: 'Application Submitted', properties: payload });
      },
    );

    this.analytics.on(ANALYTICS_VOTE_CAST, (payload: VoteCastPayload) => {
      this.logger.log(
        `[vote.cast] voteId=${payload.voteId} ` +
          `islanderId=${payload.islanderId} ` +
          `periodId=${payload.votingPeriodId} at=${payload.createdAt.toISOString()}`,
      );
      // TODO: forward to analytics provider
    });

    this.analytics.on(
      ANALYTICS_ORDER_CREATED,
      (payload: OrderCreatedPayload) => {
        this.logger.log(
          `[order.created] orderId=${payload.orderId} ` +
            `orderNumber=${payload.orderNumber} ` +
            `total=${payload.totalAmount} ${payload.currency} ` +
            `items=${payload.itemCount} at=${payload.createdAt.toISOString()}`,
        );
        // TODO: forward to analytics provider
      },
    );

    this.analytics.on(ANALYTICS_PAGE_VIEWED, (payload: PageViewedPayload) => {
      this.logger.debug(
        `[page.viewed] ${payload.method} ${payload.path} ` +
          `ip=${payload.ip ?? 'unknown'} at=${payload.timestamp.toISOString()}`,
      );
      // TODO: forward to analytics provider / increment counters
    });
  }
}
