import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePodcastEpisodes1740200000000 implements MigrationInterface {
  name = 'CreatePodcastEpisodes1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "podcast_episodes" (
        "id"             uuid         NOT NULL DEFAULT gen_random_uuid(),
        "title"          text         NOT NULL,
        "slug"           text         NOT NULL,
        "audio_url"      text         NOT NULL,
        "notes"          text,
        "thumbnail_url"  text,
        "cross_links"    jsonb,
        "status"         text         NOT NULL DEFAULT 'draft',
        "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_podcast_episodes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_podcast_episodes_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_podcast_episodes_status_created_at"
      ON "podcast_episodes" ("status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "podcast_episodes"`);
  }
}
