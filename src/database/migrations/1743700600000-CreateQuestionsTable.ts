import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionsTable1743700600000 implements MigrationInterface {
  name = 'CreateQuestionsTable1743700600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "competition_id" uuid NOT NULL,
        "question" text NOT NULL,
        "options" jsonb NOT NULL DEFAULT '[]',
        "correct_answer" text NOT NULL,
        CONSTRAINT "PK_questions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_questions_competition_id" FOREIGN KEY ("competition_id")
          REFERENCES "competitions" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "questions"`);
  }
}
