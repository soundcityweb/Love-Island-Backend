import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Vote } from './vote.entity';
import { VotingPeriodStatus } from './voting-period-status.enum';

@Entity('voting_periods')
export class VotingPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: VotingPeriodStatus,
    enumName: 'voting_period_status_enum',
    default: VotingPeriodStatus.DRAFT,
  })
  status: VotingPeriodStatus;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ name: 'results_public', type: 'boolean', default: false })
  resultsPublic: boolean;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalizedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Vote, (vote) => vote.votingPeriod)
  votes: Vote[];

  /** True if now is within [startsAt, endsAt] */
  isActive(): boolean {
    const now = new Date();
    return now >= this.startsAt && now <= this.endsAt;
  }
}
