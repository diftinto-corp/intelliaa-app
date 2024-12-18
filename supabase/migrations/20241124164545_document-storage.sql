drop trigger if exists "set_pdf_docs_timestamp" on "public"."pdf_docs";

drop trigger if exists "set_pdf_docs_user_tracking" on "public"."pdf_docs";

drop policy "Account members can delete" on "public"."pdf_docs";

drop policy "Account members can insert" on "public"."pdf_docs";

drop policy "All logged in users can select" on "public"."pdf_docs";

alter table "public"."pdf_docs" drop constraint "pdf_docs_created_by_fkey";

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'pdf_docs_s3_key_key' 
        AND table_name = 'pdf_docs'
    ) THEN
        alter table "public"."pdf_docs" drop constraint "pdf_docs_s3_key_key";
    END IF;
END $$;

alter table "public"."pdf_docs" drop constraint "pdf_docs_updated_by_fkey";

alter table "public"."pdf_docs" drop constraint "public_pdf_docs_account_id_fkey";

alter table "public"."pdf_docs" drop constraint "public_pdf_docs_document_storage_id_fkey";

drop index if exists "public"."pdf_docs_s3_key_key";

alter table "public"."pdf_docs" drop column "account_id";

alter table "public"."pdf_docs" drop column "created_by";

alter table "public"."pdf_docs" drop column "document_storage_id";

alter table "public"."pdf_docs" drop column "s3_key";

alter table "public"."pdf_docs" drop column "updated_by";

alter table "public"."pdf_docs" add column "document_storages_id" uuid default gen_random_uuid();

alter table "public"."pdf_docs" alter column "created_at" set default now();

alter table "public"."pdf_docs" alter column "created_at" set not null;

alter table "public"."pdf_docs" alter column "id" set default gen_random_uuid();

alter table "public"."pdf_docs" alter column "updated_at" set default now();

alter table "public"."pdf_docs" add constraint "public_pdf_docs_document_storages_id_fkey" FOREIGN KEY (document_storages_id) REFERENCES document_storages(id) not valid;

alter table "public"."pdf_docs" validate constraint "public_pdf_docs_document_storages_id_fkey";


