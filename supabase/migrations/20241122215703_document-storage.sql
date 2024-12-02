revoke delete on table "public"."document_storages-pdf_docs" from "anon";

revoke insert on table "public"."document_storages-pdf_docs" from "anon";

revoke references on table "public"."document_storages-pdf_docs" from "anon";

revoke select on table "public"."document_storages-pdf_docs" from "anon";

revoke trigger on table "public"."document_storages-pdf_docs" from "anon";

revoke truncate on table "public"."document_storages-pdf_docs" from "anon";

revoke update on table "public"."document_storages-pdf_docs" from "anon";

revoke delete on table "public"."document_storages-pdf_docs" from "authenticated";

revoke insert on table "public"."document_storages-pdf_docs" from "authenticated";

revoke references on table "public"."document_storages-pdf_docs" from "authenticated";

revoke select on table "public"."document_storages-pdf_docs" from "authenticated";

revoke trigger on table "public"."document_storages-pdf_docs" from "authenticated";

revoke truncate on table "public"."document_storages-pdf_docs" from "authenticated";

revoke update on table "public"."document_storages-pdf_docs" from "authenticated";

revoke delete on table "public"."document_storages-pdf_docs" from "service_role";

revoke insert on table "public"."document_storages-pdf_docs" from "service_role";

revoke references on table "public"."document_storages-pdf_docs" from "service_role";

revoke select on table "public"."document_storages-pdf_docs" from "service_role";

revoke trigger on table "public"."document_storages-pdf_docs" from "service_role";

revoke truncate on table "public"."document_storages-pdf_docs" from "service_role";

revoke update on table "public"."document_storages-pdf_docs" from "service_role";

alter table "public"."document_storages-pdf_docs" drop constraint "public_document_storages-pdf_docs_document_storages_Id_fkey";

alter table "public"."document_storages-pdf_docs" drop constraint "public_document_storages-pdf_docs_pdf_docs_fkey";

alter table "public"."pdf_docs" drop constraint "pdf_docs_account_id_fkey";

alter table "public"."document_storages-pdf_docs" drop constraint "document_storages-pdf_docs_pkey";

drop index if exists "public"."document_storages-pdf_docs_pkey";

drop table "public"."document_storages-pdf_docs";

alter table "public"."document_storages" add column "flowise_ds_id" text;

alter table "public"."pdf_docs" add column "document_storage_id" uuid;

alter table "public"."pdf_docs" add constraint "public_pdf_docs_account_id_fkey" FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) not valid;

alter table "public"."pdf_docs" validate constraint "public_pdf_docs_account_id_fkey";

alter table "public"."pdf_docs" add constraint "public_pdf_docs_document_storage_id_fkey" FOREIGN KEY (document_storage_id) REFERENCES document_storages(id) not valid;

alter table "public"."pdf_docs" validate constraint "public_pdf_docs_document_storage_id_fkey";


