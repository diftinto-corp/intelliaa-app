revoke delete on table "public"."assistants" from "anon";

revoke insert on table "public"."assistants" from "anon";

revoke references on table "public"."assistants" from "anon";

revoke select on table "public"."assistants" from "anon";

revoke trigger on table "public"."assistants" from "anon";

revoke truncate on table "public"."assistants" from "anon";

revoke update on table "public"."assistants" from "anon";

revoke delete on table "public"."assistants" from "authenticated";

revoke insert on table "public"."assistants" from "authenticated";

revoke references on table "public"."assistants" from "authenticated";

revoke select on table "public"."assistants" from "authenticated";

revoke trigger on table "public"."assistants" from "authenticated";

revoke truncate on table "public"."assistants" from "authenticated";

revoke update on table "public"."assistants" from "authenticated";

revoke delete on table "public"."assistants" from "service_role";

revoke insert on table "public"."assistants" from "service_role";

revoke references on table "public"."assistants" from "service_role";

revoke select on table "public"."assistants" from "service_role";

revoke trigger on table "public"."assistants" from "service_role";

revoke truncate on table "public"."assistants" from "service_role";

revoke update on table "public"."assistants" from "service_role";

revoke delete on table "public"."assistants_template" from "anon";

revoke insert on table "public"."assistants_template" from "anon";

revoke references on table "public"."assistants_template" from "anon";

revoke select on table "public"."assistants_template" from "anon";

revoke trigger on table "public"."assistants_template" from "anon";

revoke truncate on table "public"."assistants_template" from "anon";

revoke update on table "public"."assistants_template" from "anon";

revoke delete on table "public"."assistants_template" from "authenticated";

revoke insert on table "public"."assistants_template" from "authenticated";

revoke references on table "public"."assistants_template" from "authenticated";

revoke select on table "public"."assistants_template" from "authenticated";

revoke trigger on table "public"."assistants_template" from "authenticated";

revoke truncate on table "public"."assistants_template" from "authenticated";

revoke update on table "public"."assistants_template" from "authenticated";

revoke delete on table "public"."assistants_template" from "service_role";

revoke insert on table "public"."assistants_template" from "service_role";

revoke references on table "public"."assistants_template" from "service_role";

revoke select on table "public"."assistants_template" from "service_role";

revoke trigger on table "public"."assistants_template" from "service_role";

revoke truncate on table "public"."assistants_template" from "service_role";

revoke update on table "public"."assistants_template" from "service_role";

alter table "public"."assistants" drop constraint "assistants_pkey";

alter table "public"."assistants_template" drop constraint "assistants_template_pkey";

drop index if exists "public"."assistants_pkey";

drop index if exists "public"."assistants_template_pkey";

drop table "public"."assistants";

drop table "public"."assistants_template";


