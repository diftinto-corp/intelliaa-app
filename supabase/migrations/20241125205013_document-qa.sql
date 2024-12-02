alter table "public"."qa_docs" drop constraint "public_qa_docs_assistant_id_fkey";

alter table "public"."qa_docs" drop column "assistant_id";

alter table "public"."qa_docs" drop column "id_document";

alter table "public"."qa_docs" drop column "namespace";

alter table "public"."qa_docs" add column "document_storage_id" uuid;

alter table "public"."qa_docs" disable row level security;

alter table "public"."qa_docs" add constraint "public_qa_docs_document_storage_id_fkey" FOREIGN KEY (document_storage_id) REFERENCES document_storages(id) not valid;

alter table "public"."qa_docs" validate constraint "public_qa_docs_document_storage_id_fkey";


