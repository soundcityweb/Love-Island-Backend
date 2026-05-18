import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds payment gateway columns to the payments table:
 * - provider  (varchar 32, default 'paystack')
 * - amount    (decimal 12,2, nullable)
 * - currency  (varchar 3, nullable)
 * - index on gateway_reference for fast webhook lookups
 */
export class AddPaymentColumns1739262400000 implements MigrationInterface {
  name = 'AddPaymentColumns1739262400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "provider"  varchar(32)    NOT NULL DEFAULT 'paystack',
        ADD COLUMN IF NOT EXISTS "amount"    decimal(12,2),
        ADD COLUMN IF NOT EXISTS "currency"  varchar(3)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_gateway_reference"
        ON "payments" ("gateway_reference")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_gateway_reference"`);
    await queryRunner.query(`
      ALTER TABLE "payments"
        DROP COLUMN IF EXISTS "currency",
        DROP COLUMN IF EXISTS "amount",
        DROP COLUMN IF EXISTS "provider"
    `);
  }
}
