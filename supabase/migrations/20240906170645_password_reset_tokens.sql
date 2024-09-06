drop policy "Allow delete own token" on "public"."password_reset_tokens";

drop policy "Allow insert for all" on "public"."password_reset_tokens";

drop policy "Allow insert for authenticated users" on "public"."password_reset_tokens";

drop policy "Allow read own token" on "public"."password_reset_tokens";

drop policy "Allow read token" on "public"."password_reset_tokens";

revoke delete on table "public"."password_reset_tokens" from "anon";

revoke insert on table "public"."password_reset_tokens" from "anon";

revoke references on table "public"."password_reset_tokens" from "anon";

revoke select on table "public"."password_reset_tokens" from "anon";

revoke trigger on table "public"."password_reset_tokens" from "anon";

revoke truncate on table "public"."password_reset_tokens" from "anon";

revoke update on table "public"."password_reset_tokens" from "anon";

revoke delete on table "public"."password_reset_tokens" from "authenticated";

revoke insert on table "public"."password_reset_tokens" from "authenticated";

revoke references on table "public"."password_reset_tokens" from "authenticated";

revoke select on table "public"."password_reset_tokens" from "authenticated";

revoke trigger on table "public"."password_reset_tokens" from "authenticated";

revoke truncate on table "public"."password_reset_tokens" from "authenticated";

revoke update on table "public"."password_reset_tokens" from "authenticated";

revoke delete on table "public"."password_reset_tokens" from "service_role";

revoke insert on table "public"."password_reset_tokens" from "service_role";

revoke references on table "public"."password_reset_tokens" from "service_role";

revoke select on table "public"."password_reset_tokens" from "service_role";

revoke trigger on table "public"."password_reset_tokens" from "service_role";

revoke truncate on table "public"."password_reset_tokens" from "service_role";

revoke update on table "public"."password_reset_tokens" from "service_role";

alter table "public"."password_reset_tokens" drop constraint "password_reset_tokens_token_key";

alter table "public"."password_reset_tokens" drop constraint "password_reset_tokens_pkey";

drop index if exists "public"."password_reset_tokens_pkey";

drop index if exists "public"."password_reset_tokens_token_key";

drop table "public"."password_reset_tokens";


