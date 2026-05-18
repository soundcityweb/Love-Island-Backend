import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Competition } from './competition.entity';

/**
 * A question belonging to a Competition.
 *
 * `options`       — JSON array of answer strings (e.g. ["Ayo", "Bolu", "Cam"]).
 * `correctAnswer` — Exact string from `options`; NEVER exposed in public API responses.
 */
@Entity('questions')
@Index(['competitionId'])
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'competition_id' })
  competitionId: string;

  @ManyToOne(() => Competition, (c) => c.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competition_id' })
  competition: Competition;

  @Column({ type: 'text' })
  question: string;

  /**
   * Ordered list of answer options.
   * Stored as jsonb; minimum 2, maximum 6 options recommended.
   */
  @Column({ type: 'jsonb', default: [] })
  options: string[];

  /**
   * Must exactly match one entry in `options`.
   * Server-side only — excluded from all public DTO projections.
   */
  @Column({ name: 'correct_answer', type: 'text' })
  correctAnswer: string;
}
