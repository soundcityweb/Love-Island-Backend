import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add tagline, looking_for, profile_status_label to applications.
 */
export class AddApplicationTaglineLookingForStatusLabel1739261200000
  implements MigrationInterface
{
  name = 'AddApplicationTaglineLookingForStatusLabel1739261200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "tagline" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "looking_for" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "profile_status_label" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN IF EXISTS "tagline"`);
    await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN IF EXISTS "looking_for"`);
    await queryRunner.query(
      `ALTER TABLE "applications" DROP COLUMN IF EXISTS "profile_status_label"`,
    );
  }
}
