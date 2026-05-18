import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Non-destructive migration: creates islanders and islander_media
 * tables with UUID primary keys, status/media type enums, SEO fields,
 * public visibility flags, ordering, and timestamps.
 * Safe to run on an empty database; uses IF NOT EXISTS / exception handling
 * to avoid errors if objects already exist.
 */
export class CreateIslandersSchema1739260900000
  implements MigrationInterface
{
  name = 'CreateIslandersSchema1739260900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types (idempotent: ignore if already exists)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "islanders_status_enum" AS ENUM (
          'active',
          'evicted'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "islander_media_type_enum" AS ENUM (
          'profile',
          'cover',
          'gallery',
          'video'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Create islanders table (idempotent)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "islanders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "is_public" boolean NOT NULL DEFAULT false,
        "status" "islanders_status_enum" NOT NULL DEFAULT 'active',
        "first_name" character varying NOT NULL,
        "last_name" character varying,
        "age" integer NOT NULL,
        "location" character varying NOT NULL,
        "occupation" character varying,
        "tagline" character varying(200),
        "bio" text,
        "looking_for" text,
        "profile_image" character varying(512),
        "cover_image" character varying(512),
        "fun_facts" jsonb,
        "social_links" jsonb,
        "meta_title" character varying(200),
        "meta_description" character varying(500),
        "og_image" character varying(512),
        "twitter_image" character varying(512),
        "keywords" character varying(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_islanders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_islanders_slug" UNIQUE ("slug")
      )
    `);

    // Create islander_media table (idempotent)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "islander_media" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "islander_id" uuid NOT NULL,
        "type" "islander_media_type_enum" NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "storage_key" character varying(512) NOT NULL,
        "alt_text" character varying(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_islander_media_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_islander_media_islander_id" FOREIGN KEY ("islander_id")
          REFERENCES "islanders"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Indexes for islanders table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_islanders_is_public_display_order"
        ON "islanders" ("is_public", "display_order")
    `);

    // Indexes for islander_media table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_islander_media_islander_id_display_order"
        ON "islander_media" ("islander_id", "display_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_islander_media_islander_id_display_order"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_islanders_is_public_display_order"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "islander_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "islanders"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "islander_media_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "islanders_status_enum"`);
  }
}
