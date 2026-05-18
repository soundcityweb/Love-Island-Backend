import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { VotingEventEmitter, VOTE_RECORDED, VoteRecordedPayload } from './voting-events';

/**
 * Subscribes to vote events when the module loads. Demonstrates event-based handling
 * (e.g. logging, metrics, cache invalidation) without coupling to the write path.
 */
@Injectable()
export class VotingEventsListener implements OnModuleInit {
  private readonly logger = new Logger(VotingEventsListener.name);

  constructor(private readonly votingEvents: VotingEventEmitter) {}

  onModuleInit(): void {
    this.votingEvents.on(VOTE_RECORDED, (payload: VoteRecordedPayload) => {
      this.logger.debug(`Event: ${VOTE_RECORDED}`, payload);
      // Extend here: send to analytics, invalidate cache, etc.
    });
  }
}
