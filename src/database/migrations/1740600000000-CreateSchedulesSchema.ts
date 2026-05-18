import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schedule module: schedules with content type, platform, and air times.
 */
export class CreateSchedulesSchema1740600000000 implements MigrationInterface {
  name = 'CreateSchedulesSchema1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "schedule_content_type_enum" AS ENUM (
          'episode', 'first_look', 'recap', 'podcast', 'highlight'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "schedule_platform_enum" AS ENUM (
          'ontv', 'soundcity', 'spice', 'digital'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schedules" (
        "id"              uuid         NOT NULL DEFAULT gen_random_uuid(),
        "title"           text         NOT NULL,
        "episode_number"  integer,
        "content_type"    "schedule_content_type_enum" NOT NULL,
        "platform"        "schedule_platform_enum" NOT NULL,
        "date"            date         NOT NULL,
        "start_time"      time         NOT NULL,
        "end_time"        time,
        "description"     text,
        "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schedules_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schedules_date"
        ON "schedules" ("date")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schedules_platform"
        ON "schedules" ("platform")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_schedules_episode_number"
        ON "schedules" ("episode_number")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "schedules"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "schedule_platform_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "schedule_content_type_enum"`);
  }
}
