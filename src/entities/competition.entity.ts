import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CompetitionType } from './competition-type.enum';
import { CompetitionStatus } from './competition-status.enum';
import { Question } from './question.entity';
import { Submission } from './submission.entity';
import { CompetitionWinner } from './competition-winner.entity';

/**
 * A fan competition — quiz, poll, prediction, or upload challenge.
 *
 * The `type` and `status` columns are stored as plain text (matching the
 * existing migrations). TypeScript enums enforce valid values at the
 * application layer; no PostgreSQL enum type is created.
 */
@Entity('competitions')
@Index(['slug'], { unique: true })
@Index(['status'])
export class Competition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  /** URL-safe unique identifier; auto-generated from title if not supplied. */
  @Column({ type: 'text', unique: true })
  slug: string;

  /** quiz | poll | prediction | upload */
  @Column({ type: 'text' })
  type: CompetitionType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'banner_url', type: 'text', nullable: true })
  bannerUrl: string | null;

  @Column({ name: 'sponsor_name', type: 'text', nullable: true })
  sponsorName: string | null;

  @Column({ name: 'sponsor_logo', type: 'text', nullable: true })
  sponsorLogo: string | null;

  /** Competition opens at this UTC timestamp. */
  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt: Date | null;

  /** Competition closes at this UTC timestamp. */
  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date | null;

  /** draft | active | upcoming | completed */
  @Column({ type: 'text', default: CompetitionStatus.DRAFT })
  status: CompetitionStatus;

  /**
   * Optional JSON string describing the reward for winners.
   * e.g. {"type":"voucher","value":"5000","currency":"NGN"}
   * Stored as plain text; parsed by the frontend RewardCard component.
   */
  @Column({ name: 'reward_config', type: 'text', nullable: true, default: null })
  rewardConfig: string | null;

  /**
   * How many winners to select when the competition closes.
   * NULL = use the type-based default (3 for quiz/prediction, 1 for poll/upload).
   */
  @Column({ name: 'winner_count', type: 'int', nullable: true, default: null })
  winnerCount: number | null;

  /** Questions belong to this competition; deleted when competition is deleted. */
  @OneToMany(() => Question, (q) => q.competition, { cascade: true })
  questions: Question[];

  /** Submissions for this competition. */
  @OneToMany(() => Submission, (s) => s.competition)
  submissions: Submission[];

  /** Ranked winners — populated by WinnerSelectionService after competition closes. */
  @OneToMany(() => CompetitionWinner, (w) => w.competition)
  winners: CompetitionWinner[];
}
