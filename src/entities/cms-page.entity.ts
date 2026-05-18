import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CmsPageStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('cms_pages')
@Index(['slug'], { unique: true })
@Index(['status'])
export class CmsPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ unique: true, type: 'varchar', length: 256 })
  slug: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'meta_title', type: 'varchar', length: 200, nullable: true })
  metaTitle: string | null;

  @Column({ name: 'meta_description', type: 'text', nullable: true })
  metaDescription: string | null;

  @Column({
    type: 'enum',
    enum: CmsPageStatus,
    default: CmsPageStatus.DRAFT,
  })
  status: CmsPageStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
