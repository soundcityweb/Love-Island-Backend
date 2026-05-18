import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Islander } from './islander.entity';

export enum IslanderMediaType {
  PROFILE = 'profile',
  GALLERY = 'gallery',
  VIDEO = 'video',
}

@Entity('islander_media')
@Index(['islanderId', 'displayOrder'])
export class IslanderMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'islander_id' })
  islanderId: string;

  @ManyToOne(() => Islander, (islander) => islander.media, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'islander_id' })
  islander: Islander;

  @Column({
    type: 'enum',
    enum: IslanderMediaType,
  })
  type: IslanderMediaType;

  /** Display order within the same type (0 = primary/main) */
  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  /** Provider-agnostic storage key (e.g. Cloudinary public_id, S3 object key).
   *  Never stores absolute URLs — use the frontend URL builder to render. */
  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey: string;

  /** Alt text for accessibility and SEO */
  @Column({ name: 'alt_text', type: 'varchar', length: 500, nullable: true })
  altText: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
