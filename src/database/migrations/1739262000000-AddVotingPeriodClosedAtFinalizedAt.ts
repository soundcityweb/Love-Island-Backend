import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds closed_at and finalized_at (nullable timestamptz) to voting_periods.
 * No existing columns are modified.
 */
export class AddVotingPeriodClosedAtFinalizedAt1739262000000 implements MigrationInterface {
  name = 'AddVotingPeriodClosedAtFinalizedAt1739262000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voting_periods"
      ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "voting_periods"
      ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voting_periods"
      DROP COLUMN IF EXISTS "finalized_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "voting_periods"
      DROP COLUMN IF EXISTS "closed_at"
    `);
  }
}
