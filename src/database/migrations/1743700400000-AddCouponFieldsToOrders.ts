import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCouponFieldsToOrders1743700400000 implements MigrationInterface {
  name = 'AddCouponFieldsToOrders1743700400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "coupon_code" varchar(64) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "discount_amount" decimal(12,2) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "coupon_code",
        DROP COLUMN IF EXISTS "discount_amount"
    `);
  }
}
