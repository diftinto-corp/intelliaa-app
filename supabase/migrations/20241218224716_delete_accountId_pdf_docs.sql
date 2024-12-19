alter table "public"."pdf_docs" drop constraint "public_pdf_docs_account_id_fkey";

alter table "public"."pdf_docs" drop column "account_id";

alter table "public"."pdf_docs" drop column "s3_key";


