drop policy "Account members can update" on "public"."qa_docs";

alter table "public"."assistants" drop column "docs_pdf_urls";

alter table "public"."assistants" add column "docs_keys" text[];

alter table "public"."assistants" alter column "temperature" set data type numeric using "temperature"::numeric;

alter table "public"."assistants" alter column "token" set data type numeric using "token"::numeric;

alter table "public"."assistants_template" add column "docs_key" text[];

alter table "public"."assistants_template" add column "prompt" text;

alter table "public"."assistants_template" add column "temperature" numeric;

alter table "public"."assistants_template" add column "tokens" numeric;

alter table "public"."qa_docs" drop column "answare";

alter table "public"."qa_docs" add column "answer" text;

alter table "public"."qa_docs" add column "document_id" text;

alter table "public"."qa_docs" add column "namespace" text;

create policy "Enable insert for authenticated users only"
on "public"."documents"
as permissive
for insert
to authenticated, anon
with check (true);


create policy "Enable read access for all users"
on "public"."documents"
as permissive
for select
to public
using (true);


create policy "Enable delete for users based on user_id"
on "public"."qa_docs"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."qa_docs"
as permissive
for update
to authenticated
using (true);



