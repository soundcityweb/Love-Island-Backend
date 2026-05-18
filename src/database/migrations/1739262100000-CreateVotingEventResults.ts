import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates voting_event_results table: snapshot of vote counts per contestant at finalization.
 */
export class CreateVotingEventResults1739262100000 implements MigrationInterface {
  name = 'CreateVotingEventResults1739262100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "voting_event_results" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "voting_period_id" uuid NOT NULL,
        "islander_id" uuid NOT NULL,
        "vote_count" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voting_event_results_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_voting_event_results_period_islander" UNIQUE ("voting_period_id", "islander_id"),
        CONSTRAINT "FK_voting_event_results_period" FOREIGN KEY ("voting_period_id")
          REFERENCES "voting_periods"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_voting_event_results_islander" FOREIGN KEY ("islander_id")
          REFERENCES "islanders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_voting_event_results_voting_period_id"
        ON "voting_event_results" ("voting_period_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_voting_event_results_voting_period_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "voting_event_results"`);
  }
}
