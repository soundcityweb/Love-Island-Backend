import { EventEmitter } from 'events';

export const VOTE_RECORDED = 'vote.recorded';

/** Payload for vote.recorded; no session/fingerprint to avoid leaking private data. */
export interface VoteRecordedPayload {
  voteId: string;
  votingPeriodId: string;
  islanderId: string;
  createdAt: Date;
}

/**
 * In-process event bus for voting. Emits after a vote is successfully persisted.
 * Use for logging, analytics, or cache invalidation. No new frameworks; Node built-in EventEmitter.
 */
export class VotingEventEmitter extends EventEmitter {
  emitVoteRecorded(payload: VoteRecordedPayload): void {
    this.emit(VOTE_RECORDED, payload);
  }
}
