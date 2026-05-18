import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNewsletterSubscribers1740100000000 implements MigrationInterface {
  name = 'CreateNewsletterSubscribers1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
        "id"                 uuid         NOT NULL DEFAULT gen_random_uuid(),
        "email"              varchar(320) NOT NULL,
        "unsubscribe_token"  uuid         NOT NULL,
        "active"             boolean      NOT NULL DEFAULT true,
        "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_newsletter_subscribers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_newsletter_subscribers_email" UNIQUE ("email"),
        CONSTRAINT "UQ_newsletter_subscribers_unsubscribe_token" UNIQUE ("unsubscribe_token")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "newsletter_subscribers"`);
  }
}
