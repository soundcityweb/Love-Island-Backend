import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VotingPeriod } from './voting-period.entity';
import { Islander } from './islander.entity';

/**
 * Immutable vote record. Append-only; no updates or deletes in business logic.
 * One vote per (voting_period_id, voter_fingerprint) enforced by unique constraint.
 */
@Entity('votes')
@Index(['votingPeriodId', 'voterFingerprint'], { unique: true })
export class Vote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'voting_period_id' })
  votingPeriodId: string;

  @ManyToOne(() => VotingPeriod, (period) => period.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'voting_period_id' })
  votingPeriod: VotingPeriod;

  @Column({ name: 'islander_id' })
  islanderId: string;

  @ManyToOne(() => Islander, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'islander_id' })
  islander: Islander;

  /** Server-derived fingerprint (e.g. hash of IP + user-agent or session); not client-controlled. */
  @Column({ name: 'voter_fingerprint', type: 'varchar', length: 512 })
  voterFingerprint: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
