import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContactMessages1744200000000 implements MigrationInterface {
  name = 'CreateContactMessages1744200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "contact_subject_enum" AS ENUM (
          'general_inquiry', 'support', 'partnerships', 'media', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "contact_message_status_enum" AS ENUM ('new', 'in_progress', 'resolved');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "contact_auto_category_enum" AS ENUM (
          'general', 'voting_competition', 'payment', 'partnership', 'media', 'support', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contact_messages" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"             varchar(200) NOT NULL,
        "email"            varchar(320) NOT NULL,
        "phone"            varchar(40),
        "subject"          "contact_subject_enum" NOT NULL,
        "message"          text NOT NULL,
        "attachment_url"   text,
        "status"           "contact_message_status_enum" NOT NULL DEFAULT 'new',
        "category"         "contact_auto_category_enum" NOT NULL DEFAULT 'general',
        "is_urgent"        boolean NOT NULL DEFAULT false,
        "first_response_at" timestamptz,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contact_messages_status_created"
        ON "contact_messages" ("status", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contact_messages_email"
        ON "contact_messages" ("email")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contact_message_replies" (
        "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "contact_message_id"  uuid NOT NULL REFERENCES "contact_messages"("id") ON DELETE CASCADE,
        "body"                text NOT NULL,
        "sent_by_label"       varchar(200),
        "created_at"          timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contact_message_replies_message_id"
        ON "contact_message_replies" ("contact_message_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_message_replies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_messages"`);
    await queryRunner.query(`
      DO $$ BEGIN DROP TYPE "contact_auto_category_enum"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN DROP TYPE "contact_message_status_enum"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN DROP TYPE "contact_subject_enum"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
    `);
  }
}
