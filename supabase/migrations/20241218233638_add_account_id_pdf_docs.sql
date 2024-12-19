alter table "public"."pdf_docs" drop constraint "pdf_docs_pkey";

drop index if exists "public"."pdf_docs_pkey";

alter table "public"."document_storages" add column "namespace" text;


