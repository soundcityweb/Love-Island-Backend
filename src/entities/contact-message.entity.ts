import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ContactMessageReply } from './contact-message-reply.entity';

export enum ContactSubject {
  GENERAL_INQUIRY = 'general_inquiry',
  SUPPORT = 'support',
  PARTNERSHIPS = 'partnerships',
  MEDIA = 'media',
  OTHER = 'other',
}

export enum ContactMessageStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

/** Auto-detected from message keywords (automation). */
export enum ContactAutoCategory {
  GENERAL = 'general',
  VOTING_COMPETITION = 'voting_competition',
  PAYMENT = 'payment',
  PARTNERSHIP = 'partnership',
  MEDIA = 'media',
  SUPPORT = 'support',
  OTHER = 'other',
}

@Entity('contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'enum', enum: ContactSubject })
  subject!: ContactSubject;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl!: string | null;

  @Column({ type: 'enum', enum: ContactMessageStatus, default: ContactMessageStatus.NEW })
  status!: ContactMessageStatus;

  @Column({
    type: 'enum',
    enum: ContactAutoCategory,
    default: ContactAutoCategory.GENERAL,
  })
  category!: ContactAutoCategory;

  @Column({ name: 'is_urgent', type: 'boolean', default: false })
  isUrgent!: boolean;

  @Column({ name: 'first_response_at', type: 'timestamptz', nullable: true })
  firstResponseAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Lazy require avoids circular init with ContactMessageReply when
   * `emitDecoratorMetadata` is enabled.
   */
  @OneToMany(
    () => require('./contact-message-reply.entity').ContactMessageReply,
    (r: ContactMessageReply) => r.contactMessage,
  )
  replies!: ContactMessageReply[];
}
