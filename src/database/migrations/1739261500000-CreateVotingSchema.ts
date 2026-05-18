import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates voting_periods and votes tables for production-grade voting.
 * Votes are append-only (immutable). One vote per voter per period.
 */
export class CreateVotingSchema1739261500000 implements MigrationInterface {
  name = 'CreateVotingSchema1739261500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "voting_periods" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voting_periods_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_voting_periods_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "votes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "voting_period_id" uuid NOT NULL,
        "islander_id" uuid NOT NULL,
        "voter_fingerprint" character varying(512) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_votes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_votes_period_fingerprint" UNIQUE ("voting_period_id", "voter_fingerprint"),
        CONSTRAINT "FK_votes_voting_period" FOREIGN KEY ("voting_period_id")
          REFERENCES "voting_periods"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_votes_islander" FOREIGN KEY ("islander_id")
          REFERENCES "islanders"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_votes_voting_period_id"
        ON "votes" ("voting_period_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_votes_islander_id"
        ON "votes" ("islander_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_votes_islander_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_votes_voting_period_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "voting_periods"`);
  }
}
