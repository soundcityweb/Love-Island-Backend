import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds optional description column to voting_periods.
 */
export class AddVotingPeriodDescription1739261900000 implements MigrationInterface {
  name = 'AddVotingPeriodDescription1739261900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voting_periods"
      ADD COLUMN IF NOT EXISTS "description" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voting_periods"
      DROP COLUMN IF EXISTS "description"
    `);
  }
}
