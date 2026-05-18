import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Non-destructive migration: creates applications and application_media
 * tables with UUID primary keys, status/media type enums, and timestamps.
 * Safe to run on an empty database; uses IF NOT EXISTS / exception handling
 * to avoid errors if objects already exist.
 */
export class CreateApplicationsSchema1739260800000
  implements MigrationInterface
{
  name = 'CreateApplicationsSchema1739260800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types (idempotent: ignore if already exists)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "applications_status_enum" AS ENUM (
          'submitted',
          'under_review',
          'accepted',
          'rejected'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "application_media_type_enum" AS ENUM (
          'image',
          'video'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Create applications table (idempotent)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "applications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "status" "applications_status_enum" NOT NULL DEFAULT 'submitted',
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "phone" character varying NOT NULL,
        "age" integer NOT NULL,
        "gender" character varying NOT NULL,
        "city" character varying NOT NULL,
        "occupation" character varying NOT NULL,
        "bio" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_applications_id" PRIMARY KEY ("id")
      )
    `);

    // Create application_media table (idempotent)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "application_media" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "application_id" uuid NOT NULL,
        "type" "application_media_type_enum" NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "storage_key" character varying(512) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_media_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_application_media_application_id" FOREIGN KEY ("application_id")
          REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Index for listing applications by status and created_at (admin list)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_applications_status"
        ON "applications" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_applications_created_at"
        ON "applications" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_application_media_application_id"
        ON "application_media" ("application_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_application_media_application_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_applications_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_applications_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "application_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "applications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "application_media_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "applications_status_enum"`);
  }
}
