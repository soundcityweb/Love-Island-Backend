import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds shipping-related columns to the orders table:
 * - shipped_at  (timestamptz, nullable) — set when an order is marked SHIPPED
 * - updated_at  (timestamptz, NOT NULL DEFAULT now()) — general-purpose audit column
 */
export class AddOrderShippedAt1739262500000 implements MigrationInterface {
  name = 'AddOrderShippedAt1739262500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "shipped_at"  timestamptz,
        ADD COLUMN IF NOT EXISTS "updated_at"  timestamptz NOT NULL DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "shipped_at",
        DROP COLUMN IF EXISTS "updated_at"
    `);
  }
}
