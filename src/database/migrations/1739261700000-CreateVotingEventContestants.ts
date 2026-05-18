import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates voting_event_contestants join table: which islanders are contestants in a voting event (period).
 */
export class CreateVotingEventContestants1739261700000 implements MigrationInterface {
  name = 'CreateVotingEventContestants1739261700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "voting_event_contestants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "voting_period_id" uuid NOT NULL,
        "islander_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voting_event_contestants_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_voting_event_contestants_period_islander" UNIQUE ("voting_period_id", "islander_id"),
        CONSTRAINT "FK_voting_event_contestants_period" FOREIGN KEY ("voting_period_id")
          REFERENCES "voting_periods"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_voting_event_contestants_islander" FOREIGN KEY ("islander_id")
          REFERENCES "islanders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_voting_event_contestants_voting_period_id"
        ON "voting_event_contestants" ("voting_period_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_voting_event_contestants_islander_id"
        ON "voting_event_contestants" ("islander_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_voting_event_contestants_islander_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_voting_event_contestants_voting_period_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "voting_event_contestants"`);
  }
}
