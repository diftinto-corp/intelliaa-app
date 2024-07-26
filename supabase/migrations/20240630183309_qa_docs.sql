create extension vector;

create table "public"."documents" (
    "id" text not null,
    "content" text,
    "metadata" jsonb,
    "embedding" vector(1536)
);


alter table "public"."assistants" add column "activated_whatsApp" boolean default false;

alter table "public"."assistants" add column "docs_pdf_urls" text[];

alter table "public"."assistants" add column "keyword_transfer_ws" text;

alter table "public"."assistants" add column "namespace" text;

alter table "public"."assistants" add column "number_transfer_ws" text;

alter table "public"."assistants" add column "prompt" text;

alter table "public"."assistants" add column "temperature" real;

alter table "public"."assistants" add column "token" smallint;

alter table "public"."pdf_docs" add column "description" text;

alter table "public"."pdf_docs" add column "name" text;

alter table "public"."pdf_docs" add column "s3_key" text;

alter table "public"."pdf_docs" add column "url" text;

alter table "public"."qa_docs" add column "answare" text;

alter table "public"."qa_docs" add column "assistant_id" uuid;

alter table "public"."qa_docs" add column "question" text;

CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id);

alter table "public"."documents" add constraint "documents_pkey" PRIMARY KEY using index "documents_pkey";

alter table "public"."qa_docs" add constraint "public_qa_docs_assistant_id_fkey" FOREIGN KEY (assistant_id) REFERENCES assistants(id) not valid;

alter table "public"."qa_docs" validate constraint "public_qa_docs_assistant_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id text, content text, metadata jsonb, similarity double precision)
 LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$function$
;

grant delete on table "public"."documents" to "anon";

grant insert on table "public"."documents" to "anon";

grant references on table "public"."documents" to "anon";

grant select on table "public"."documents" to "anon";

grant trigger on table "public"."documents" to "anon";

grant truncate on table "public"."documents" to "anon";

grant update on table "public"."documents" to "anon";

grant delete on table "public"."documents" to "authenticated";

grant insert on table "public"."documents" to "authenticated";

grant references on table "public"."documents" to "authenticated";

grant select on table "public"."documents" to "authenticated";

grant trigger on table "public"."documents" to "authenticated";

grant truncate on table "public"."documents" to "authenticated";

grant update on table "public"."documents" to "authenticated";

grant delete on table "public"."documents" to "service_role";

grant insert on table "public"."documents" to "service_role";

grant references on table "public"."documents" to "service_role";

grant select on table "public"."documents" to "service_role";

grant trigger on table "public"."documents" to "service_role";

grant truncate on table "public"."documents" to "service_role";

grant update on table "public"."documents" to "service_role";

create policy "Account members can delete"
on "public"."pdf_docs"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."pdf_docs"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "All logged in users can select"
on "public"."pdf_docs"
as permissive
for select
to authenticated
using (true);


create policy "Account members can insert"
on "public"."qa_docs"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."qa_docs"
as permissive
for update
to authenticator
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "All logged in users can select"
on "public"."qa_docs"
as permissive
for select
to authenticated
using (true);



