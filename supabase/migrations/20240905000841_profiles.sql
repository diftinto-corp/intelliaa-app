alter table "public"."profiles" drop constraint "public_profiles_id_fkey";

alter table "public"."profiles" drop column "account_id";

alter table "public"."profiles" drop column "created_at";

alter table "public"."profiles" drop column "last_name";

alter table "public"."profiles" drop column "name";

alter table "public"."profiles" add column "full_name" text;

alter table "public"."profiles" add column "organization_name" text;

alter table "public"."profiles" add column "updated_at" timestamp with time zone;

alter table "public"."profiles" alter column "is_active" set default false;

CREATE UNIQUE INDEX email_unique ON public.profiles USING btree (email);

alter table "public"."profiles" add constraint "email_unique" UNIQUE using index "email_unique";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, full_name, avatar_url, email, is_active, organization_name)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    false,
    new.raw_user_meta_data->>'organization_name'
  );
  return new;
end;
$function$
;

create policy "Public profiles are viewable by everyone."
on "public"."profiles"
as permissive
for select
to public
using (true);


create policy "Users can insert their own profile."
on "public"."profiles"
as permissive
for insert
to public
with check ((( SELECT auth.uid() AS uid) = id));


create policy "Users can update own profile."
on "public"."profiles"
as permissive
for update
to public
using ((( SELECT auth.uid() AS uid) = id));



