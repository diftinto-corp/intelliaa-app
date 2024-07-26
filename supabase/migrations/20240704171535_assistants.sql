drop policy "Enable insert for authenticated users only" on "public"."documents";

drop policy "Enable read access for all users" on "public"."documents";

alter table "public"."assistants" add column "document_id" text;

alter table "public"."assistants_template" drop column "docs_key";

alter table "public"."assistants_template" add column "s3_key" text;

grant select on table "public"."documents" to "authenticator";

create policy "Account members can update"
on "public"."assistants"
as permissive
for update
to authenticated
using (true);



