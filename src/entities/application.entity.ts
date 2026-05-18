import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApplicationStatus } from './application-status.enum';
import { ApplicationMedia } from './application-media.entity';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.SUBMITTED,
  })
  status: ApplicationStatus;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column()
  age: number;

  @Column()
  gender: string;

  @Column()
  city: string;

  @Column()
  occupation: string;

  @Column({ type: 'text' })
  bio: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  tagline: string | null;

  @Column({ name: 'looking_for', type: 'text', nullable: true })
  lookingFor: string | null;

  @Column({ name: 'profile_status_label', type: 'varchar', length: 200, nullable: true })
  profileStatusLabel: string | null;

  @Column({ name: 'fun_facts', type: 'jsonb', nullable: true })
  funFacts: Array<{ icon: string; label: string; value: string }> | null;

  @Column({ name: 'social_links', type: 'jsonb', nullable: true })
  socialLinks: Array<{ platform: string; handle: string; url: string }> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ApplicationMedia, (media) => media.application)
  media: ApplicationMedia[];
}
