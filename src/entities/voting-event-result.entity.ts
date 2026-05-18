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
 * Snapshot of vote counts per contestant at close/finalization.
 * Written once when the voting event is closed; read by results endpoints when finalized_at is set.
 */
@Entity('voting_event_results')
@Index(['votingPeriodId', 'islanderId'], { unique: true })
export class VotingEventResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'voting_period_id' })
  votingPeriodId: string;

  @ManyToOne(() => VotingPeriod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'voting_period_id' })
  votingPeriod: VotingPeriod;

  @Column({ name: 'islander_id' })
  islanderId: string;

  @ManyToOne(() => Islander, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'islander_id' })
  islander: Islander;

  @Column({ name: 'vote_count', type: 'int' })
  voteCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
