import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompetitionsTable1743700500000 implements MigrationInterface {
  name = 'CreateCompetitionsTable1743700500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "competitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" text NOT NULL,
        "slug" text NOT NULL,
        "type" text NOT NULL,
        "description" text DEFAULT NULL,
        "banner_url" text DEFAULT NULL,
        "sponsor_name" text DEFAULT NULL,
        "sponsor_logo" text DEFAULT NULL,
        "start_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "end_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        CONSTRAINT "PK_competitions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_competitions_slug" UNIQUE ("slug")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "competitions"`);
  }
}
