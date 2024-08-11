create table "public"."active_numbers" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "number" text,
    "id_assistant" text,
    "country" text,
    "type" text,
    "is_active" boolean
);


alter table "public"."active_numbers" enable row level security;

CREATE UNIQUE INDEX active_numbers_pkey ON public.active_numbers USING btree (id);

alter table "public"."active_numbers" add constraint "active_numbers_pkey" PRIMARY KEY using index "active_numbers_pkey";

grant delete on table "public"."active_numbers" to "anon";

grant insert on table "public"."active_numbers" to "anon";

grant references on table "public"."active_numbers" to "anon";

grant select on table "public"."active_numbers" to "anon";

grant trigger on table "public"."active_numbers" to "anon";

grant truncate on table "public"."active_numbers" to "anon";

grant update on table "public"."active_numbers" to "anon";

grant delete on table "public"."active_numbers" to "authenticated";

grant insert on table "public"."active_numbers" to "authenticated";

grant references on table "public"."active_numbers" to "authenticated";

grant select on table "public"."active_numbers" to "authenticated";

grant trigger on table "public"."active_numbers" to "authenticated";

grant truncate on table "public"."active_numbers" to "authenticated";

grant update on table "public"."active_numbers" to "authenticated";

grant delete on table "public"."active_numbers" to "service_role";

grant insert on table "public"."active_numbers" to "service_role";

grant references on table "public"."active_numbers" to "service_role";

grant select on table "public"."active_numbers" to "service_role";

grant trigger on table "public"."active_numbers" to "service_role";

grant truncate on table "public"."active_numbers" to "service_role";

grant update on table "public"."active_numbers" to "service_role";

create policy "Enable insert for authenticated users only"
on "public"."active_numbers"
as permissive
for insert
to authenticated, anon
with check (true);


create policy "Enable read access for all users"
on "public"."active_numbers"
as permissive
for select
to anon
using (true);


create policy "Policy with table joins"
on "public"."active_numbers"
as permissive
for update
to anon
using (true);



