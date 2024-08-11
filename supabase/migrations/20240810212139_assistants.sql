alter table "public"."assistants" drop constraint "public_assistants_active_number_fkey";

alter table "public"."assistants" alter column "active_number" set data type text using "active_number"::text;


