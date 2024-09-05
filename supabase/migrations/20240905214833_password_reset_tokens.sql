create table "public"."password_reset_tokens" (
    "id" uuid not null default uuid_generate_v4(),
    "email" text not null,
    "token" text not null,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."password_reset_tokens" enable row level security;

CREATE UNIQUE INDEX password_reset_tokens_pkey ON public.password_reset_tokens USING btree (id);

CREATE UNIQUE INDEX password_reset_tokens_token_key ON public.password_reset_tokens USING btree (token);

alter table "public"."password_reset_tokens" add constraint "password_reset_tokens_pkey" PRIMARY KEY using index "password_reset_tokens_pkey";

alter table "public"."password_reset_tokens" add constraint "password_reset_tokens_token_key" UNIQUE using index "password_reset_tokens_token_key";

grant delete on table "public"."password_reset_tokens" to "anon";

grant insert on table "public"."password_reset_tokens" to "anon";

grant references on table "public"."password_reset_tokens" to "anon";

grant select on table "public"."password_reset_tokens" to "anon";

grant trigger on table "public"."password_reset_tokens" to "anon";

grant truncate on table "public"."password_reset_tokens" to "anon";

grant update on table "public"."password_reset_tokens" to "anon";

grant delete on table "public"."password_reset_tokens" to "authenticated";

grant insert on table "public"."password_reset_tokens" to "authenticated";

grant references on table "public"."password_reset_tokens" to "authenticated";

grant select on table "public"."password_reset_tokens" to "authenticated";

grant trigger on table "public"."password_reset_tokens" to "authenticated";

grant truncate on table "public"."password_reset_tokens" to "authenticated";

grant update on table "public"."password_reset_tokens" to "authenticated";

grant delete on table "public"."password_reset_tokens" to "service_role";

grant insert on table "public"."password_reset_tokens" to "service_role";

grant references on table "public"."password_reset_tokens" to "service_role";

grant select on table "public"."password_reset_tokens" to "service_role";

grant trigger on table "public"."password_reset_tokens" to "service_role";

grant truncate on table "public"."password_reset_tokens" to "service_role";

grant update on table "public"."password_reset_tokens" to "service_role";

create policy "Allow delete own token"
on "public"."password_reset_tokens"
as permissive
for delete
to authenticated
using ((auth.uid() IN ( SELECT auth.uid() AS uid
   FROM auth.users
  WHERE ((users.email)::text = password_reset_tokens.email))));


create policy "Allow insert for all"
on "public"."password_reset_tokens"
as permissive
for insert
to anon, authenticated
with check (true);


create policy "Allow insert for authenticated users"
on "public"."password_reset_tokens"
as permissive
for insert
to authenticated
with check (true);


create policy "Allow read own token"
on "public"."password_reset_tokens"
as permissive
for select
to authenticated
using ((auth.uid() IN ( SELECT auth.uid() AS uid
   FROM auth.users
  WHERE ((users.email)::text = password_reset_tokens.email))));


create policy "Allow read token"
on "public"."password_reset_tokens"
as permissive
for select
to anon, authenticated
using (true);



