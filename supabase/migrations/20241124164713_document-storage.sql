alter table "public"."pdf_docs" drop constraint "public_pdf_docs_document_storages_id_fkey";

alter table "public"."pdf_docs" drop column "document_storages_id";

alter table "public"."pdf_docs" add column "document_storage_id" uuid default gen_random_uuid();

alter table "public"."pdf_docs" add constraint "public_pdf_docs_document_storages_id_fkey" FOREIGN KEY (document_storage_id) REFERENCES document_storages(id) not valid;

alter table "public"."pdf_docs" validate constraint "public_pdf_docs_document_storages_id_fkey";


