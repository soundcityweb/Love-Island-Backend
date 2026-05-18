import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add status to voting_periods for admin open/close flow (draft | open | closed).
 */
export class AddVotingPeriodStatus1739261600000 implements MigrationInterface {
  name = 'AddVotingPeriodStatus1739261600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "voting_period_status_enum" AS ENUM ('draft', 'open', 'closed');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "voting_periods"
      ADD COLUMN IF NOT EXISTS "status" "voting_period_status_enum" NOT NULL DEFAULT 'draft'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voting_periods" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "voting_period_status_enum"`);
  }
}
