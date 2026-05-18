import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CMS schema: articles, videos, landing_sections.
 */
export class CreateCMSSchema1740000000000 implements MigrationInterface {
  name = 'CreateCMSSchema1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ──────────────────────────────────────────────────────────────

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "article_category_enum" AS ENUM (
          'News', 'Recaps', 'Interviews', 'Features', 'Lifestyle'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "episode_status_enum" AS ENUM ('aired', 'live', 'upcoming');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── articles ───────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "articles" (
        "id"                 uuid         NOT NULL DEFAULT gen_random_uuid(),
        "slug"               varchar(256) NOT NULL,
        "title"              varchar(300) NOT NULL,
        "excerpt"            varchar(500),
        "content"            text,
        "category"           "article_category_enum" NOT NULL DEFAULT 'News',
        "author"             varchar(200),
        "cover_image"        varchar(512),
        "is_published"       boolean      NOT NULL DEFAULT false,
        "published_at"       TIMESTAMPTZ,
        "read_time_minutes"  integer,
        "meta_title"         varchar(200),
        "meta_description"   varchar(500),
        "keywords"           varchar(500),
        "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_articles_id"   PRIMARY KEY ("id"),
        CONSTRAINT "UQ_articles_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_articles_slug"
        ON "articles" ("slug")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_articles_published"
        ON "articles" ("is_published", "published_at")
    `);

    // ── videos ─────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "videos" (
        "id"            uuid         NOT NULL DEFAULT gen_random_uuid(),
        "slug"          varchar(256) NOT NULL,
        "title"         varchar(300) NOT NULL,
        "description"   text,
        "embed_url"     varchar(512) NOT NULL,
        "thumbnail"     varchar(512),
        "duration"      varchar(20),
        "tag"           varchar(100),
        "is_published"  boolean      NOT NULL DEFAULT false,
        "display_order" integer      NOT NULL DEFAULT 0,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_videos_id"   PRIMARY KEY ("id"),
        CONSTRAINT "UQ_videos_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_slug"
        ON "videos" ("slug")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_published"
        ON "videos" ("is_published", "display_order")
    `);

    // ── landing_sections ───────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "landing_sections" (
        "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
        "section_key" varchar(64) NOT NULL,
        "content"     jsonb       NOT NULL DEFAULT '{}',
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_landing_sections_id"         PRIMARY KEY ("id"),
        CONSTRAINT "UQ_landing_sections_section_key" UNIQUE ("section_key")
      )
    `);

    // Seed the four default sections with empty content
    await queryRunner.query(`
      INSERT INTO "landing_sections" ("section_key", "content")
      VALUES
        ('hero',      '{}'),
        ('countdown', '{}'),
        ('videos',    '{}'),
        ('sponsors',  '{}')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "landing_sections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "videos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "articles"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "episode_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "article_category_enum"`);
  }
}
