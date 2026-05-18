import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds winner-selection infrastructure:
 *   1. `competitions.winner_count`  — how many winners to pick (NULL = type default).
 *   2. `competition_winners`        — stores ranked winners after a competition closes.
 */
export class CreateCompetitionWinnersTable1743700800000
  implements MigrationInterface
{
  name = 'CreateCompetitionWinnersTable1743700800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Add configurable winner count to competitions ─────────────────────
    await queryRunner.query(`
      ALTER TABLE "competitions"
        ADD COLUMN IF NOT EXISTS "winner_count" int DEFAULT NULL
    `);

    // ── 2. Create competition_winners table ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "competition_winners" (
        "id"               uuid        NOT NULL DEFAULT gen_random_uuid(),
        "competition_id"   uuid        NOT NULL,
        "user_id"          uuid        NOT NULL,
        "rank"             int         NOT NULL,
        "score"            int         NOT NULL DEFAULT 0,
        "selection_method" text        NOT NULL,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_competition_winners_id"
          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_competition_winners_comp_rank"
          UNIQUE ("competition_id", "rank"),
        CONSTRAINT "FK_competition_winners_competition"
          FOREIGN KEY ("competition_id")
          REFERENCES "competitions" ("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_competition_winners_comp"
        ON "competition_winners" ("competition_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_competition_winners_user"
        ON "competition_winners" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "competition_winners"`,
    );
    await queryRunner.query(`
      ALTER TABLE "competitions"
        DROP COLUMN IF EXISTS "winner_count"
    `);
  }
}
