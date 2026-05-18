import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToSubmissions1743701000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "submissions"
        ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_submissions_status"
        ON "submissions" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_status"`);
    await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN IF EXISTS "status"`);
  }
}
