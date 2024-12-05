alter table "public"."assistants" add column "document_storage_id" uuid;

alter table "public"."assistants" add constraint "public_assistants_document_storage_id_fkey" FOREIGN KEY (document_storage_id) REFERENCES document_storages(id) not valid;

alter table "public"."assistants" validate constraint "public_assistants_document_storage_id_fkey";


