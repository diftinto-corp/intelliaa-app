alter table "public"."qa_docs" drop column "id_vapi_doc";

alter table "public"."qa_docs" add column "vapiFileId" text;


