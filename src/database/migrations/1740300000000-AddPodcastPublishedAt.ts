import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPodcastPublishedAt1740300000000 implements MigrationInterface {
  name = 'AddPodcastPublishedAt1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "podcast_episodes"
      ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "podcast_episodes" DROP COLUMN IF EXISTS "published_at"
    `);
  }
}
