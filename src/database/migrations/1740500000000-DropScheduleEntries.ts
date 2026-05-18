import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes TV schedule CMS: schedule_entries and episode_status_enum (unused elsewhere).
 */
export class DropScheduleEntries1740500000000 implements MigrationInterface {
  name = 'DropScheduleEntries1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "schedule_entries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "episode_status_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "episode_status_enum" AS ENUM ('aired', 'live', 'upcoming');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedule_entries" (
        "id"               uuid         NOT NULL DEFAULT gen_random_uuid(),
        "episode_number"   integer,
        "title"            varchar(300) NOT NULL,
        "description"      text,
        "air_date"         date         NOT NULL,
        "air_time"         varchar(10)  NOT NULL,
        "channel"          varchar(200) NOT NULL,
        "duration_minutes" integer,
        "status"           "episode_status_enum" NOT NULL DEFAULT 'upcoming',
        "thumbnail"        varchar(512),
        "is_published"     boolean      NOT NULL DEFAULT false,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schedule_entries_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schedule_entries_air_date"
        ON "schedule_entries" ("air_date", "air_time")
    `);
  }
}
