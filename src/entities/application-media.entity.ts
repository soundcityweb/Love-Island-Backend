import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Application } from './application.entity';

export enum ApplicationMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

@Entity('application_media')
export class ApplicationMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @ManyToOne(() => Application, (application) => application.media, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column({
    type: 'enum',
    enum: ApplicationMediaType,
  })
  type: ApplicationMediaType;

  /** Display order (0 = main/primary for images) */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /** Provider-agnostic storage key (e.g. Cloudinary public_id, S3 object key).
   *  Never stores absolute URLs — use the frontend URL builder to render. */
  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
