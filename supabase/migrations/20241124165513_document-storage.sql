alter table "public"."pdf_docs" drop constraint "public_pdf_docs_document_storages_id_fkey";

alter table "public"."pdf_docs" alter column "document_storage_id" drop default;

alter table "public"."pdf_docs" disable row level security;

alter table "public"."pdf_docs" add constraint "public_pdf_docs_document_storage_id_fkey" FOREIGN KEY (document_storage_id) REFERENCES document_storages(id) not valid;

alter table "public"."pdf_docs" validate constraint "public_pdf_docs_document_storage_id_fkey";


