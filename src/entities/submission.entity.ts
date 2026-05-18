import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Competition } from './competition.entity';

/**
 * One submission per user per competition.
 * Append-only; answers are immutable after creation.
 *
 * `userId`       — Derived from the client session (see CompetitionsService.deriveUserId).
 *                  Replace with JWT subject when an auth system is introduced.
 * `answers`      — Map of { [questionId]: selectedOptionText } stored as jsonb.
 * `score`        — Pre-computed correct answer count; -1 for non-quiz types.
 */
@Entity('submissions')
@Index(['competitionId'])
@Index(['userId'])
@Index(['userId', 'competitionId'], { unique: true })
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Derived UUID representing the submitting user / session. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'competition_id' })
  competitionId: string;

  @ManyToOne(() => Competition, (c) => c.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competition_id' })
  competition: Competition;

  /**
   * Map of { [questionId]: selectedOptionText }.
   * For non-quiz types, stores whatever the client sent (e.g. poll choice).
   */
  @Column({ type: 'jsonb', default: {} })
  answers: Record<string, string>;

  /** Number of correct answers. -1 means not applicable (poll / upload). */
  @Column({ type: 'int', default: 0 })
  score: number;

  /**
   * Admin-controlled moderation status.
   * 'active'       — submitted, awaiting review (default)
   * 'approved'     — admin-approved (upload gallery)
   * 'rejected'     — admin-rejected / removed from results
   * 'disqualified' — excluded from results and winner selection
   * 'winner'       — manually marked as winner by an admin
   */
  @Column({ type: 'text', default: 'active' })
  status: 'active' | 'approved' | 'rejected' | 'disqualified' | 'winner';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
