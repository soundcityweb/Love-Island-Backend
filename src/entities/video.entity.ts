import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('videos')
@Index(['isPublished', 'displayOrder'])
@Index(['slug'], { unique: true })
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'varchar', length: 256 })
  slug: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'embed_url', type: 'varchar', length: 512 })
  embedUrl: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  thumbnail: string | null;

  /** Human-readable duration, e.g. "3:42" */
  @Column({ type: 'varchar', length: 20, nullable: true })
  duration: string | null;

  /** Content tag, e.g. "First Look", "Diary Room", "Trailer", "Preview" */
  @Column({ type: 'varchar', length: 100, nullable: true })
  tag: string | null;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
