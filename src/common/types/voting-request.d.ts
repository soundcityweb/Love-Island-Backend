declare global {
  namespace Express {
    interface Request {
      /** Set by VotingGuard: validated session identifier for 1 vote per session per event */
      votingSessionId?: string;
      /** Set by VotingGuard: SHA-256 hash of client IP (used for rate limiting; raw IP never stored) */
      votingHashedIp?: string;
    }
  }
}

export {};
