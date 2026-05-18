import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds low_stock_threshold column to products.
 * Defaults to 5 — admin can override per product.
 */
export class AddLowStockThresholdToProducts1743700100000
  implements MigrationInterface
{
  name = 'AddLowStockThresholdToProducts1743700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "low_stock_threshold" integer NOT NULL DEFAULT 5
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "low_stock_threshold"
    `);
  }
}
