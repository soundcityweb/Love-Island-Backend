import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ArticleCategory {
  NEWS = 'News',
  RECAPS = 'Recaps',
  INTERVIEWS = 'Interviews',
  FEATURES = 'Features',
  LIFESTYLE = 'Lifestyle',
}

@Entity('articles')
@Index(['isPublished', 'publishedAt'])
@Index(['slug'], { unique: true })
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'varchar', length: 256 })
  slug: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  excerpt: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({
    type: 'enum',
    enum: ArticleCategory,
    default: ArticleCategory.NEWS,
  })
  category: ArticleCategory;

  @Column({ type: 'varchar', length: 200, nullable: true })
  author: string | null;

  @Column({ name: 'cover_image', type: 'varchar', length: 512, nullable: true })
  coverImage: string | null;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'read_time_minutes', type: 'int', nullable: true })
  readTimeMinutes: number | null;

  @Column({ name: 'meta_title', type: 'varchar', length: 200, nullable: true })
  metaTitle: string | null;

  @Column({ name: 'meta_description', type: 'varchar', length: 500, nullable: true })
  metaDescription: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  keywords: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
