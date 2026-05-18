import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleIsPublished1740700000000 implements MigrationInterface {
  name = 'AddScheduleIsPublished1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "schedules"
      ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "schedules" DROP COLUMN IF EXISTS "is_published"
    `);
  }
}
