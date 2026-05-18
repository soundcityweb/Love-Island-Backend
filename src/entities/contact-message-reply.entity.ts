import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ContactMessage } from './contact-message.entity';

@Entity('contact_message_replies')
export class ContactMessageReply {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'contact_message_id', type: 'uuid' })
  contactMessageId!: string;

  @ManyToOne(() => ContactMessage, (m) => m.replies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_message_id' })
  contactMessage!: ContactMessage;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'sent_by_label', type: 'varchar', length: 200, nullable: true })
  sentByLabel!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
