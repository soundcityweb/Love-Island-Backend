import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add fun_facts and social_links (JSONB) to applications for islander profile sync.
 */
export class AddApplicationFunFactsSocialLinks1739261400000
  implements MigrationInterface
{
  name = 'AddApplicationFunFactsSocialLinks1739261400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "fun_facts" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "social_links" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "applications" DROP COLUMN IF EXISTS "fun_facts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP COLUMN IF EXISTS "social_links"`,
    );
  }
}
