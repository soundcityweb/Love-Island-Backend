import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add profile_status_label to islanders.
 */
export class AddIslanderProfileStatusLabel1739261300000
  implements MigrationInterface
{
  name = 'AddIslanderProfileStatusLabel1739261300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "islanders"
        ADD COLUMN IF NOT EXISTS "profile_status_label" character varying(200)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "islanders"
        DROP COLUMN IF EXISTS "profile_status_label"
    `);
  }
}
