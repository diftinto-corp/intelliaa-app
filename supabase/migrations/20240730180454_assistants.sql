create table "public"."voice_assistant" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "name" text,
    "id_elevenlab" text
);


alter table "public"."voice_assistant" enable row level security;

alter table "public"."assistants" add column "background_office" boolean;

alter table "public"."assistants" add column "detect_emotion" boolean;

alter table "public"."assistants" add column "record_call" boolean;

alter table "public"."assistants" add column "voice_assistant" text;

alter table "public"."assistants" add column "welcome_assistant" text;

CREATE UNIQUE INDEX voice_assistant_pkey ON public.voice_assistant USING btree (id);

alter table "public"."voice_assistant" add constraint "voice_assistant_pkey" PRIMARY KEY using index "voice_assistant_pkey";

grant delete on table "public"."voice_assistant" to "anon";

grant insert on table "public"."voice_assistant" to "anon";

grant references on table "public"."voice_assistant" to "anon";

grant select on table "public"."voice_assistant" to "anon";

grant trigger on table "public"."voice_assistant" to "anon";

grant truncate on table "public"."voice_assistant" to "anon";

grant update on table "public"."voice_assistant" to "anon";

grant delete on table "public"."voice_assistant" to "authenticated";

grant insert on table "public"."voice_assistant" to "authenticated";

grant references on table "public"."voice_assistant" to "authenticated";

grant select on table "public"."voice_assistant" to "authenticated";

grant trigger on table "public"."voice_assistant" to "authenticated";

grant truncate on table "public"."voice_assistant" to "authenticated";

grant update on table "public"."voice_assistant" to "authenticated";

grant delete on table "public"."voice_assistant" to "service_role";

grant insert on table "public"."voice_assistant" to "service_role";

grant references on table "public"."voice_assistant" to "service_role";

grant select on table "public"."voice_assistant" to "service_role";

grant trigger on table "public"."voice_assistant" to "service_role";

grant truncate on table "public"."voice_assistant" to "service_role";

grant update on table "public"."voice_assistant" to "service_role";


