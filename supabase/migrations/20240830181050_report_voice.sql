create table "public"."report_voice" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "account_id" uuid,
    "type" text,
    "ended_reason" text,
    "assistant_id" uuid,
    "assistant_name" text,
    "assistant_number" text,
    "customer_assistant" text,
    "duration_minutes" real,
    "recording_url" text,
    "messages" jsonb[],
    "transcript" text,
    "summary" text
);


alter table "public"."report_voice" enable row level security;

CREATE UNIQUE INDEX report_voice_pkey ON public.report_voice USING btree (id);

alter table "public"."report_voice" add constraint "report_voice_pkey" PRIMARY KEY using index "report_voice_pkey";

alter table "public"."report_voice" add constraint "public_report_voice_account_id_fkey" FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) not valid;

alter table "public"."report_voice" validate constraint "public_report_voice_account_id_fkey";

alter table "public"."report_voice" add constraint "public_report_voice_assistant_id_fkey" FOREIGN KEY (assistant_id) REFERENCES assistants(id) not valid;

alter table "public"."report_voice" validate constraint "public_report_voice_assistant_id_fkey";

grant delete on table "public"."report_voice" to "anon";

grant insert on table "public"."report_voice" to "anon";

grant references on table "public"."report_voice" to "anon";

grant select on table "public"."report_voice" to "anon";

grant trigger on table "public"."report_voice" to "anon";

grant truncate on table "public"."report_voice" to "anon";

grant update on table "public"."report_voice" to "anon";

grant delete on table "public"."report_voice" to "authenticated";

grant insert on table "public"."report_voice" to "authenticated";

grant references on table "public"."report_voice" to "authenticated";

grant select on table "public"."report_voice" to "authenticated";

grant trigger on table "public"."report_voice" to "authenticated";

grant truncate on table "public"."report_voice" to "authenticated";

grant update on table "public"."report_voice" to "authenticated";

grant delete on table "public"."report_voice" to "service_role";

grant insert on table "public"."report_voice" to "service_role";

grant references on table "public"."report_voice" to "service_role";

grant select on table "public"."report_voice" to "service_role";

grant trigger on table "public"."report_voice" to "service_role";

grant truncate on table "public"."report_voice" to "service_role";

grant update on table "public"."report_voice" to "service_role";


