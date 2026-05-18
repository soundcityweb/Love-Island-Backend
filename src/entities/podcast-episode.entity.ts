import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type PodcastCrossLink = { label: string; url: string };

@Entity('podcast_episodes')
@Index(['status', 'createdAt'])
export class PodcastEpisode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', unique: true })
  slug: string;

  @Column({ name: 'audio_url', type: 'text', nullable: true })
  audioUrl: string | null;

  @Column({ name: 'video_url', type: 'text', nullable: true })
  videoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'thumbnail_url', type: 'text', nullable: true })
  thumbnailUrl: string | null;

  @Column({ name: 'cross_links', type: 'jsonb', nullable: true })
  crossLinks: PodcastCrossLink[] | null;

  @Column({ type: 'text', default: 'draft' })
  status: string;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
