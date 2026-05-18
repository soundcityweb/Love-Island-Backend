import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { IslanderStatus } from './islander-status.enum';
import { IslanderMedia } from './islander-media.entity';

@Entity('islanders')
@Index(['isPublic', 'displayOrder'])
@Index(['slug'], { unique: true })
export class Islander {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({
    type: 'enum',
    enum: IslanderStatus,
    default: IslanderStatus.ACTIVE,
  })
  status: IslanderStatus;

  @Column({ name: 'first_name', type: 'varchar' })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ type: 'int' })
  age: number;

  @Column({ type: 'varchar' })
  location: string;

  @Column({ type: 'varchar', nullable: true })
  occupation: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  tagline: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'looking_for', type: 'text', nullable: true })
  lookingFor: string | null;

  @Column({ name: 'profile_status_label', type: 'varchar', length: 200, nullable: true })
  profileStatusLabel: string | null;

  @Column({ name: 'profile_image', type: 'varchar', length: 512, nullable: true })
  profileImage: string | null;

  @Column({ name: 'cover_image', type: 'varchar', length: 512, nullable: true })
  coverImage: string | null;

  /** JSON array of fun facts: [{ icon, label, value }] */
  @Column({ name: 'fun_facts', type: 'jsonb', nullable: true })
  funFacts: Array<{ icon: string; label: string; value: string }> | null;

  /** JSON array of social links: [{ platform, handle, url }] */
  @Column({ name: 'social_links', type: 'jsonb', nullable: true })
  socialLinks: Array<{ platform: string; handle: string; url: string }> | null;

  /** SEO: Meta title (overrides default: "Name, Age | Love Island Nigeria") */
  @Column({ name: 'meta_title', type: 'varchar', length: 200, nullable: true })
  metaTitle: string | null;

  /** SEO: Meta description */
  @Column({ name: 'meta_description', type: 'varchar', length: 500, nullable: true })
  metaDescription: string | null;

  /** SEO: Open Graph image URL */
  @Column({ name: 'og_image', type: 'varchar', length: 512, nullable: true })
  ogImage: string | null;

  /** SEO: Twitter card image URL */
  @Column({ name: 'twitter_image', type: 'varchar', length: 512, nullable: true })
  twitterImage: string | null;

  /** SEO: Keywords (comma-separated) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  keywords: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => IslanderMedia, (media) => media.islander, { cascade: true })
  media: IslanderMedia[];
}
