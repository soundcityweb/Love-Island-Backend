import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRewardConfigToCompetitions1743700900000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "competitions"
        ADD COLUMN IF NOT EXISTS "reward_config" text DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "competitions" DROP COLUMN IF EXISTS "reward_config"
    `);
  }
}
