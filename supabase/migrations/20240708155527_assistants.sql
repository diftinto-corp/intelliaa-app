
drop policy "Account members can update" on "public"."assistants";

alter table "public"."assistants" add column "is_deploying_ws" boolean default false;

alter table "public"."assistants" add column "qr_url" text;

alter table "public"."assistants" add column "service_id_rw" text;

alter table "public"."assistants" alter column "docs_keys" set data type jsonb[] using "docs_keys"::jsonb[];

alter table "public"."embedded_pdfs" add column "assistant_id" uuid;

alter table "public"."embedded_pdfs" add column "id_document" text;

alter table "public"."embedded_pdfs" add column "pdf_doc_key" text;

alter table "public"."qa_docs" drop column "document_id";

alter table "public"."qa_docs" add column "id_document" text;

CREATE UNIQUE INDEX assistants_namespace_key ON public.assistants USING btree (namespace);

CREATE UNIQUE INDEX pdf_docs_s3_key_key ON public.pdf_docs USING btree (s3_key);

alter table "public"."assistants" add constraint "assistants_namespace_key" UNIQUE using index "assistants_namespace_key";

alter table "public"."embedded_pdfs" add constraint "public_embedded_pdfs_assistant_id_fkey" FOREIGN KEY (assistant_id) REFERENCES assistants(id) not valid;

alter table "public"."embedded_pdfs" validate constraint "public_embedded_pdfs_assistant_id_fkey";

alter table "public"."pdf_docs" add constraint "pdf_docs_s3_key_key" UNIQUE using index "pdf_docs_s3_key_key";

create policy "Account members can delete"
on "public"."embedded_pdfs"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."embedded_pdfs"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can select"
on "public"."embedded_pdfs"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."assistants"
as permissive
for update
to authenticated, anon
using (true);



