import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds results_public to voting_periods (controls public visibility of results).
 * Adds composite index on votes(voting_period_id, islander_id) for aggregation (count per islander).
 */
export class AddResultsPublicAndVoteAggregationIndex1739261800000 implements MigrationInterface {
  name = 'AddResultsPublicAndVoteAggregationIndex1739261800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voting_periods"
      ADD COLUMN IF NOT EXISTS "results_public" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_votes_period_islander_aggregation"
      ON "votes" ("voting_period_id", "islander_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_votes_period_islander_aggregation"`);
    await queryRunner.query(`ALTER TABLE "voting_periods" DROP COLUMN IF EXISTS "results_public"`);
  }
}
