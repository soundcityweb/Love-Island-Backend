import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCmsPages1744100000000 implements MigrationInterface {
  name = 'CreateCmsPages1744100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "cms_page_status_enum" AS ENUM ('draft', 'published');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cms_pages" (
        "id"               uuid         NOT NULL DEFAULT gen_random_uuid(),
        "title"            varchar(300) NOT NULL,
        "slug"             varchar(256) NOT NULL,
        "content"          text         NOT NULL,
        "meta_title"       varchar(200),
        "meta_description" text,
        "status"           "cms_page_status_enum" NOT NULL DEFAULT 'draft',
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cms_pages_id"   PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cms_pages_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cms_pages_status"
        ON "cms_pages" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cms_pages"`);
    await queryRunner.query(`
      DO $$ BEGIN
        DROP TYPE "cms_page_status_enum";
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
    `);
  }
}
