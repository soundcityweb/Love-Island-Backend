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

export type WinnerSelectionMethod = 'top_score' | 'random' | 'manual';

/**
 * Represents one ranked winner for a competition.
 *
 * Populated by WinnerSelectionService after a competition's end_at passes.
 * One row per rank per competition — rank 1 is the top winner.
 *
 * `userId` is the same derived-UUID used in Submission; the derivation is
 * deterministic from the X-Session-Id header so the same fan always maps to
 * the same userId without a login system.
 */
@Entity('competition_winners')
@Index(['competitionId'])
@Index(['userId'])
export class CompetitionWinner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'competition_id' })
  competitionId: string;

  @ManyToOne(() => Competition, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'competition_id' })
  competition: Competition;

  /** Derived session UUID — matches Submission.userId for the same fan. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /**
   * 1-based ranking. 1 = first place, 2 = runner-up, etc.
   * Combined with competitionId this is unique (enforced by DB constraint).
   */
  @Column({ type: 'int' })
  rank: number;

  /** Score at the time the competition closed. 0 for non-scored types. */
  @Column({ type: 'int', default: 0 })
  score: number;

  /** How this winner was chosen: 'top_score' for quiz/prediction, 'random' for poll/upload. */
  @Column({ name: 'selection_method', type: 'text' })
  selectionMethod: WinnerSelectionMethod;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
