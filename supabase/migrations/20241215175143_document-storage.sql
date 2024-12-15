drop trigger if exists "set_embedded_pdfs_timestamp" on "public"."embedded_pdfs";

drop trigger if exists "set_embedded_pdfs_user_tracking" on "public"."embedded_pdfs";

drop policy "Account members can delete" on "public"."embedded_pdfs";

drop policy "Account members can insert" on "public"."embedded_pdfs";

drop policy "Account members can select" on "public"."embedded_pdfs";

revoke delete on table "public"."docuement_storage_assistants" from "anon";

revoke insert on table "public"."docuement_storage_assistants" from "anon";

revoke references on table "public"."docuement_storage_assistants" from "anon";

revoke select on table "public"."docuement_storage_assistants" from "anon";

revoke trigger on table "public"."docuement_storage_assistants" from "anon";

revoke truncate on table "public"."docuement_storage_assistants" from "anon";

revoke update on table "public"."docuement_storage_assistants" from "anon";

revoke delete on table "public"."docuement_storage_assistants" from "authenticated";

revoke insert on table "public"."docuement_storage_assistants" from "authenticated";

revoke references on table "public"."docuement_storage_assistants" from "authenticated";

revoke select on table "public"."docuement_storage_assistants" from "authenticated";

revoke trigger on table "public"."docuement_storage_assistants" from "authenticated";

revoke truncate on table "public"."docuement_storage_assistants" from "authenticated";

revoke update on table "public"."docuement_storage_assistants" from "authenticated";

revoke delete on table "public"."docuement_storage_assistants" from "service_role";

revoke insert on table "public"."docuement_storage_assistants" from "service_role";

revoke references on table "public"."docuement_storage_assistants" from "service_role";

revoke select on table "public"."docuement_storage_assistants" from "service_role";

revoke trigger on table "public"."docuement_storage_assistants" from "service_role";

revoke truncate on table "public"."docuement_storage_assistants" from "service_role";

revoke update on table "public"."docuement_storage_assistants" from "service_role";

revoke delete on table "public"."documents" from "anon";

revoke insert on table "public"."documents" from "anon";

revoke references on table "public"."documents" from "anon";

revoke select on table "public"."documents" from "anon";

revoke trigger on table "public"."documents" from "anon";

revoke truncate on table "public"."documents" from "anon";

revoke update on table "public"."documents" from "anon";

revoke delete on table "public"."documents" from "authenticated";

revoke insert on table "public"."documents" from "authenticated";

revoke references on table "public"."documents" from "authenticated";

revoke select on table "public"."documents" from "authenticated";

revoke trigger on table "public"."documents" from "authenticated";

revoke truncate on table "public"."documents" from "authenticated";

revoke update on table "public"."documents" from "authenticated";

revoke select on table "public"."documents" from "authenticator";

revoke delete on table "public"."documents" from "service_role";

revoke insert on table "public"."documents" from "service_role";

revoke references on table "public"."documents" from "service_role";

revoke select on table "public"."documents" from "service_role";

revoke trigger on table "public"."documents" from "service_role";

revoke truncate on table "public"."documents" from "service_role";

revoke update on table "public"."documents" from "service_role";

revoke delete on table "public"."embedded_pdfs" from "anon";

revoke insert on table "public"."embedded_pdfs" from "anon";

revoke references on table "public"."embedded_pdfs" from "anon";

revoke select on table "public"."embedded_pdfs" from "anon";

revoke trigger on table "public"."embedded_pdfs" from "anon";

revoke truncate on table "public"."embedded_pdfs" from "anon";

revoke update on table "public"."embedded_pdfs" from "anon";

revoke delete on table "public"."embedded_pdfs" from "authenticated";

revoke insert on table "public"."embedded_pdfs" from "authenticated";

revoke references on table "public"."embedded_pdfs" from "authenticated";

revoke select on table "public"."embedded_pdfs" from "authenticated";

revoke trigger on table "public"."embedded_pdfs" from "authenticated";

revoke truncate on table "public"."embedded_pdfs" from "authenticated";

revoke update on table "public"."embedded_pdfs" from "authenticated";

revoke delete on table "public"."embedded_pdfs" from "service_role";

revoke insert on table "public"."embedded_pdfs" from "service_role";

revoke references on table "public"."embedded_pdfs" from "service_role";

revoke select on table "public"."embedded_pdfs" from "service_role";

revoke trigger on table "public"."embedded_pdfs" from "service_role";

revoke truncate on table "public"."embedded_pdfs" from "service_role";

revoke update on table "public"."embedded_pdfs" from "service_role";

alter table "public"."docuement_storage_assistants" drop constraint "public_docuement_storage_assistants_assistantId_fkey";

alter table "public"."docuement_storage_assistants" drop constraint "public_docuement_storage_assistants_document_storage_Id_fkey";

alter table "public"."embedded_pdfs" drop constraint "embedded_pdfs_account_id_fkey";

alter table "public"."embedded_pdfs" drop constraint "embedded_pdfs_created_by_fkey";

alter table "public"."embedded_pdfs" drop constraint "embedded_pdfs_updated_by_fkey";

alter table "public"."embedded_pdfs" drop constraint "public_embedded_pdfs_assistant_id_fkey";

alter table "public"."docuement_storage_assistants" drop constraint "docuementStorage-assistants_pkey";

alter table "public"."documents" drop constraint "documents_pkey";

alter table "public"."embedded_pdfs" drop constraint "embedded_pdfs_pkey";

drop index if exists "public"."docuementStorage-assistants_pkey";

drop index if exists "public"."documents_pkey";

drop index if exists "public"."embedded_pdfs_pkey";

drop table "public"."docuement_storage_assistants";

drop table "public"."documents";

drop table "public"."embedded_pdfs";


