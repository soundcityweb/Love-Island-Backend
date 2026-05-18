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

@Entity('voting_event_contestants')
@Index(['votingPeriodId', 'islanderId'], { unique: true })
export class VotingEventContestant {
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
