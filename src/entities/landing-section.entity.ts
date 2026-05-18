import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * One row per content section of the landing page.
 * Sections: 'hero' | 'countdown' | 'videos' | 'sponsors'
 * Content is stored as free-form JSONB so each section can evolve independently.
 */
@Entity('landing_sections')
@Index(['sectionKey'], { unique: true })
export class LandingSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique key identifying the section, e.g. "hero", "countdown" */
  @Column({ name: 'section_key', type: 'varchar', length: 64, unique: true })
  sectionKey: string;

  @Column({ type: 'jsonb', default: '{}' })
  content: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
