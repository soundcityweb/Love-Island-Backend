import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubmissionsTable1743700700000 implements MigrationInterface {
  name = 'CreateSubmissionsTable1743700700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "submissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "competition_id" uuid NOT NULL,
        "answers" jsonb NOT NULL DEFAULT '{}',
        "score" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_submissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_submissions_competition_id" FOREIGN KEY ("competition_id")
          REFERENCES "competitions" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_submissions_user_id" ON "submissions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_submissions_competition_id" ON "submissions" ("competition_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_competition_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_submissions_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "submissions"`);
  }
}
