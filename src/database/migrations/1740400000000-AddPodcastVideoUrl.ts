import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPodcastVideoUrl1740400000000 implements MigrationInterface {
  name = 'AddPodcastVideoUrl1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "podcast_episodes" ADD COLUMN IF NOT EXISTS "video_url" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "podcast_episodes" ALTER COLUMN "audio_url" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "podcast_episodes" DROP COLUMN IF EXISTS "video_url"
    `);
    // Restore NOT NULL only if no null audio_url rows (best-effort revert)
    await queryRunner.query(`
      UPDATE "podcast_episodes" SET "audio_url" = '' WHERE "audio_url" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "podcast_episodes" ALTER COLUMN "audio_url" SET NOT NULL
    `);
  }
}
