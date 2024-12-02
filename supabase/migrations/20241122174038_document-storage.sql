create table "public"."assistant_tools" (
    "id" uuid not null default gen_random_uuid(),
    "assistant_id" uuid,
    "tool_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."assistant_tools" enable row level security;

create table "public"."docuement_storage_assistants" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "assistantId" uuid,
    "document_storage_Id" uuid,
    "update_at" timestamp with time zone
);


create table "public"."document_storages" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "description" text,
    "created_at" timestamp with time zone not null default now(),
    "update_at" timestamp with time zone default now(),
    "account_id" uuid
);


create table "public"."document_storages-pdf_docs" (
    "id" uuid not null default gen_random_uuid(),
    "document_storages_Id" uuid default gen_random_uuid(),
    "pdf_docs" uuid default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now()
);


create table "public"."external_api_keys" (
    "id" uuid not null default uuid_generate_v4(),
    "account_id" uuid not null,
    "service_name" text not null,
    "api_key" text,
    "account_sid" text,
    "auth_token" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."external_api_keys" enable row level security;

create table "public"."tool_properties" (
    "id" uuid not null default gen_random_uuid(),
    "tool_id" uuid,
    "property_name" text not null,
    "description" text not null,
    "is_required" boolean default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone default now()
);


create table "public"."tools" (
    "id" uuid not null default gen_random_uuid(),
    "account_id" uuid,
    "name" text not null,
    "webhook_url" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


CREATE UNIQUE INDEX assistant_tools_pkey ON public.assistant_tools USING btree (id);

CREATE UNIQUE INDEX "docuementStorage-assistants_pkey" ON public.docuement_storage_assistants USING btree (id);

CREATE UNIQUE INDEX "document_storages-pdf_docs_pkey" ON public."document_storages-pdf_docs" USING btree (id);

CREATE UNIQUE INDEX document_storages_pkey ON public.document_storages USING btree (id);

CREATE UNIQUE INDEX external_api_keys_pkey ON public.external_api_keys USING btree (id);

CREATE INDEX idx_assistant_tools_assistant_id ON public.assistant_tools USING btree (assistant_id);

CREATE INDEX idx_assistant_tools_tool_id ON public.assistant_tools USING btree (tool_id);

CREATE INDEX idx_external_api_keys_account_id ON public.external_api_keys USING btree (account_id);

CREATE INDEX idx_external_api_keys_service_name ON public.external_api_keys USING btree (service_name);

CREATE INDEX idx_tool_properties_tool_id ON public.tool_properties USING btree (tool_id);

CREATE UNIQUE INDEX tool_properties_pkey ON public.tool_properties USING btree (id);

CREATE UNIQUE INDEX tool_properties_tool_id_key ON public.tool_properties USING btree (tool_id);

CREATE UNIQUE INDEX tools_pkey ON public.tools USING btree (id);

alter table "public"."assistant_tools" add constraint "assistant_tools_pkey" PRIMARY KEY using index "assistant_tools_pkey";

alter table "public"."docuement_storage_assistants" add constraint "docuementStorage-assistants_pkey" PRIMARY KEY using index "docuementStorage-assistants_pkey";

alter table "public"."document_storages" add constraint "document_storages_pkey" PRIMARY KEY using index "document_storages_pkey";

alter table "public"."document_storages-pdf_docs" add constraint "document_storages-pdf_docs_pkey" PRIMARY KEY using index "document_storages-pdf_docs_pkey";

alter table "public"."external_api_keys" add constraint "external_api_keys_pkey" PRIMARY KEY using index "external_api_keys_pkey";

alter table "public"."tool_properties" add constraint "tool_properties_pkey" PRIMARY KEY using index "tool_properties_pkey";

alter table "public"."tools" add constraint "tools_pkey" PRIMARY KEY using index "tools_pkey";

alter table "public"."assistant_tools" add constraint "public_assistant_tools_assistant_id_fkey" FOREIGN KEY (assistant_id) REFERENCES assistants(id) not valid;

alter table "public"."assistant_tools" validate constraint "public_assistant_tools_assistant_id_fkey";

alter table "public"."assistant_tools" add constraint "public_assistant_tools_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES tools(id) not valid;

alter table "public"."assistant_tools" validate constraint "public_assistant_tools_tool_id_fkey";

alter table "public"."docuement_storage_assistants" add constraint "public_docuement_storage_assistants_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES assistants(id) not valid;

alter table "public"."docuement_storage_assistants" validate constraint "public_docuement_storage_assistants_assistantId_fkey";

alter table "public"."docuement_storage_assistants" add constraint "public_docuement_storage_assistants_document_storage_Id_fkey" FOREIGN KEY ("document_storage_Id") REFERENCES document_storages(id) not valid;

alter table "public"."docuement_storage_assistants" validate constraint "public_docuement_storage_assistants_document_storage_Id_fkey";

alter table "public"."document_storages" add constraint "public_document_storages_account_id_fkey" FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) not valid;

alter table "public"."document_storages" validate constraint "public_document_storages_account_id_fkey";

alter table "public"."document_storages-pdf_docs" add constraint "public_document_storages-pdf_docs_document_storages_Id_fkey" FOREIGN KEY ("document_storages_Id") REFERENCES document_storages(id) not valid;

alter table "public"."document_storages-pdf_docs" validate constraint "public_document_storages-pdf_docs_document_storages_Id_fkey";

alter table "public"."document_storages-pdf_docs" add constraint "public_document_storages-pdf_docs_pdf_docs_fkey" FOREIGN KEY (pdf_docs) REFERENCES pdf_docs(id) not valid;

alter table "public"."document_storages-pdf_docs" validate constraint "public_document_storages-pdf_docs_pdf_docs_fkey";

alter table "public"."external_api_keys" add constraint "external_api_keys_account_id_fkey" FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) ON DELETE CASCADE not valid;

alter table "public"."external_api_keys" validate constraint "external_api_keys_account_id_fkey";

alter table "public"."tool_properties" add constraint "public_tool_properties_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES tools(id) not valid;

alter table "public"."tool_properties" validate constraint "public_tool_properties_tool_id_fkey";

alter table "public"."tool_properties" add constraint "tool_properties_tool_id_key" UNIQUE using index "tool_properties_tool_id_key";

alter table "public"."tools" add constraint "public_tools_account_id_fkey" FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) not valid;

alter table "public"."tools" validate constraint "public_tools_account_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$
;

grant delete on table "public"."assistant_tools" to "anon";

grant insert on table "public"."assistant_tools" to "anon";

grant references on table "public"."assistant_tools" to "anon";

grant select on table "public"."assistant_tools" to "anon";

grant trigger on table "public"."assistant_tools" to "anon";

grant truncate on table "public"."assistant_tools" to "anon";

grant update on table "public"."assistant_tools" to "anon";

grant delete on table "public"."assistant_tools" to "authenticated";

grant insert on table "public"."assistant_tools" to "authenticated";

grant references on table "public"."assistant_tools" to "authenticated";

grant select on table "public"."assistant_tools" to "authenticated";

grant trigger on table "public"."assistant_tools" to "authenticated";

grant truncate on table "public"."assistant_tools" to "authenticated";

grant update on table "public"."assistant_tools" to "authenticated";

grant delete on table "public"."assistant_tools" to "service_role";

grant insert on table "public"."assistant_tools" to "service_role";

grant references on table "public"."assistant_tools" to "service_role";

grant select on table "public"."assistant_tools" to "service_role";

grant trigger on table "public"."assistant_tools" to "service_role";

grant truncate on table "public"."assistant_tools" to "service_role";

grant update on table "public"."assistant_tools" to "service_role";

grant delete on table "public"."docuement_storage_assistants" to "anon";

grant insert on table "public"."docuement_storage_assistants" to "anon";

grant references on table "public"."docuement_storage_assistants" to "anon";

grant select on table "public"."docuement_storage_assistants" to "anon";

grant trigger on table "public"."docuement_storage_assistants" to "anon";

grant truncate on table "public"."docuement_storage_assistants" to "anon";

grant update on table "public"."docuement_storage_assistants" to "anon";

grant delete on table "public"."docuement_storage_assistants" to "authenticated";

grant insert on table "public"."docuement_storage_assistants" to "authenticated";

grant references on table "public"."docuement_storage_assistants" to "authenticated";

grant select on table "public"."docuement_storage_assistants" to "authenticated";

grant trigger on table "public"."docuement_storage_assistants" to "authenticated";

grant truncate on table "public"."docuement_storage_assistants" to "authenticated";

grant update on table "public"."docuement_storage_assistants" to "authenticated";

grant delete on table "public"."docuement_storage_assistants" to "service_role";

grant insert on table "public"."docuement_storage_assistants" to "service_role";

grant references on table "public"."docuement_storage_assistants" to "service_role";

grant select on table "public"."docuement_storage_assistants" to "service_role";

grant trigger on table "public"."docuement_storage_assistants" to "service_role";

grant truncate on table "public"."docuement_storage_assistants" to "service_role";

grant update on table "public"."docuement_storage_assistants" to "service_role";

grant delete on table "public"."document_storages" to "anon";

grant insert on table "public"."document_storages" to "anon";

grant references on table "public"."document_storages" to "anon";

grant select on table "public"."document_storages" to "anon";

grant trigger on table "public"."document_storages" to "anon";

grant truncate on table "public"."document_storages" to "anon";

grant update on table "public"."document_storages" to "anon";

grant delete on table "public"."document_storages" to "authenticated";

grant insert on table "public"."document_storages" to "authenticated";

grant references on table "public"."document_storages" to "authenticated";

grant select on table "public"."document_storages" to "authenticated";

grant trigger on table "public"."document_storages" to "authenticated";

grant truncate on table "public"."document_storages" to "authenticated";

grant update on table "public"."document_storages" to "authenticated";

grant delete on table "public"."document_storages" to "service_role";

grant insert on table "public"."document_storages" to "service_role";

grant references on table "public"."document_storages" to "service_role";

grant select on table "public"."document_storages" to "service_role";

grant trigger on table "public"."document_storages" to "service_role";

grant truncate on table "public"."document_storages" to "service_role";

grant update on table "public"."document_storages" to "service_role";

grant delete on table "public"."document_storages-pdf_docs" to "anon";

grant insert on table "public"."document_storages-pdf_docs" to "anon";

grant references on table "public"."document_storages-pdf_docs" to "anon";

grant select on table "public"."document_storages-pdf_docs" to "anon";

grant trigger on table "public"."document_storages-pdf_docs" to "anon";

grant truncate on table "public"."document_storages-pdf_docs" to "anon";

grant update on table "public"."document_storages-pdf_docs" to "anon";

grant delete on table "public"."document_storages-pdf_docs" to "authenticated";

grant insert on table "public"."document_storages-pdf_docs" to "authenticated";

grant references on table "public"."document_storages-pdf_docs" to "authenticated";

grant select on table "public"."document_storages-pdf_docs" to "authenticated";

grant trigger on table "public"."document_storages-pdf_docs" to "authenticated";

grant truncate on table "public"."document_storages-pdf_docs" to "authenticated";

grant update on table "public"."document_storages-pdf_docs" to "authenticated";

grant delete on table "public"."document_storages-pdf_docs" to "service_role";

grant insert on table "public"."document_storages-pdf_docs" to "service_role";

grant references on table "public"."document_storages-pdf_docs" to "service_role";

grant select on table "public"."document_storages-pdf_docs" to "service_role";

grant trigger on table "public"."document_storages-pdf_docs" to "service_role";

grant truncate on table "public"."document_storages-pdf_docs" to "service_role";

grant update on table "public"."document_storages-pdf_docs" to "service_role";

grant delete on table "public"."external_api_keys" to "anon";

grant insert on table "public"."external_api_keys" to "anon";

grant references on table "public"."external_api_keys" to "anon";

grant select on table "public"."external_api_keys" to "anon";

grant trigger on table "public"."external_api_keys" to "anon";

grant truncate on table "public"."external_api_keys" to "anon";

grant update on table "public"."external_api_keys" to "anon";

grant delete on table "public"."external_api_keys" to "authenticated";

grant insert on table "public"."external_api_keys" to "authenticated";

grant references on table "public"."external_api_keys" to "authenticated";

grant select on table "public"."external_api_keys" to "authenticated";

grant trigger on table "public"."external_api_keys" to "authenticated";

grant truncate on table "public"."external_api_keys" to "authenticated";

grant update on table "public"."external_api_keys" to "authenticated";

grant delete on table "public"."external_api_keys" to "service_role";

grant insert on table "public"."external_api_keys" to "service_role";

grant references on table "public"."external_api_keys" to "service_role";

grant select on table "public"."external_api_keys" to "service_role";

grant trigger on table "public"."external_api_keys" to "service_role";

grant truncate on table "public"."external_api_keys" to "service_role";

grant update on table "public"."external_api_keys" to "service_role";

grant delete on table "public"."tool_properties" to "anon";

grant insert on table "public"."tool_properties" to "anon";

grant references on table "public"."tool_properties" to "anon";

grant select on table "public"."tool_properties" to "anon";

grant trigger on table "public"."tool_properties" to "anon";

grant truncate on table "public"."tool_properties" to "anon";

grant update on table "public"."tool_properties" to "anon";

grant delete on table "public"."tool_properties" to "authenticated";

grant insert on table "public"."tool_properties" to "authenticated";

grant references on table "public"."tool_properties" to "authenticated";

grant select on table "public"."tool_properties" to "authenticated";

grant trigger on table "public"."tool_properties" to "authenticated";

grant truncate on table "public"."tool_properties" to "authenticated";

grant update on table "public"."tool_properties" to "authenticated";

grant delete on table "public"."tool_properties" to "service_role";

grant insert on table "public"."tool_properties" to "service_role";

grant references on table "public"."tool_properties" to "service_role";

grant select on table "public"."tool_properties" to "service_role";

grant trigger on table "public"."tool_properties" to "service_role";

grant truncate on table "public"."tool_properties" to "service_role";

grant update on table "public"."tool_properties" to "service_role";

grant delete on table "public"."tools" to "anon";

grant insert on table "public"."tools" to "anon";

grant references on table "public"."tools" to "anon";

grant select on table "public"."tools" to "anon";

grant trigger on table "public"."tools" to "anon";

grant truncate on table "public"."tools" to "anon";

grant update on table "public"."tools" to "anon";

grant delete on table "public"."tools" to "authenticated";

grant insert on table "public"."tools" to "authenticated";

grant references on table "public"."tools" to "authenticated";

grant select on table "public"."tools" to "authenticated";

grant trigger on table "public"."tools" to "authenticated";

grant truncate on table "public"."tools" to "authenticated";

grant update on table "public"."tools" to "authenticated";

grant delete on table "public"."tools" to "service_role";

grant insert on table "public"."tools" to "service_role";

grant references on table "public"."tools" to "service_role";

grant select on table "public"."tools" to "service_role";

grant trigger on table "public"."tools" to "service_role";

grant truncate on table "public"."tools" to "service_role";

grant update on table "public"."tools" to "service_role";

create policy "assistant_tools_delete_policy"
on "public"."assistant_tools"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM ((tools
     JOIN assistants ON ((assistants.id = assistant_tools.assistant_id)))
     JOIN basejump.account_user ON ((account_user.account_id = tools.account_id)))
  WHERE ((assistant_tools.tool_id = tools.id) AND (assistants.account_id = tools.account_id) AND (account_user.user_id = auth.uid())))));


create policy "assistant_tools_insert_policy"
on "public"."assistant_tools"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM ((tools
     JOIN assistants ON ((assistants.id = assistant_tools.assistant_id)))
     JOIN basejump.account_user ON ((account_user.account_id = tools.account_id)))
  WHERE ((assistant_tools.tool_id = tools.id) AND (assistants.account_id = tools.account_id) AND (account_user.user_id = auth.uid())))));


create policy "assistant_tools_select_policy"
on "public"."assistant_tools"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM ((tools
     JOIN assistants ON ((assistants.id = assistant_tools.assistant_id)))
     JOIN basejump.account_user ON ((account_user.account_id = tools.account_id)))
  WHERE ((assistant_tools.tool_id = tools.id) AND (assistants.account_id = tools.account_id) AND (account_user.user_id = auth.uid())))));


create policy "assistant_tools_update_policy"
on "public"."assistant_tools"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM ((tools
     JOIN assistants ON ((assistants.id = assistant_tools.assistant_id)))
     JOIN basejump.account_user ON ((account_user.account_id = tools.account_id)))
  WHERE ((assistant_tools.tool_id = tools.id) AND (assistants.account_id = tools.account_id) AND (account_user.user_id = auth.uid())))));


create policy "external_api_keys_delete_policy"
on "public"."external_api_keys"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM basejump.account_user
  WHERE ((account_user.account_id = external_api_keys.account_id) AND (account_user.user_id = auth.uid())))));


create policy "external_api_keys_insert_policy"
on "public"."external_api_keys"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM basejump.account_user
  WHERE ((account_user.account_id = external_api_keys.account_id) AND (account_user.user_id = auth.uid())))));


create policy "external_api_keys_select_policy"
on "public"."external_api_keys"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM basejump.account_user
  WHERE ((account_user.account_id = external_api_keys.account_id) AND (account_user.user_id = auth.uid())))));


create policy "external_api_keys_update_policy"
on "public"."external_api_keys"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM basejump.account_user
  WHERE ((account_user.account_id = external_api_keys.account_id) AND (account_user.user_id = auth.uid())))));


create policy "tool_properties_delete_policy"
on "public"."tool_properties"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM (tools
     JOIN basejump.account_user ON ((account_user.account_id = tools.account_id)))
  WHERE ((tool_properties.tool_id = tools.id) AND (account_user.user_id = auth.uid())))));


create policy "tool_properties_insert_policy"
on "public"."tool_properties"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM (tools
     JOIN basejump.account_user ON ((account_user.account_id = tools.account_id)))
  WHERE ((tool_properties.tool_id = tools.id) AND (account_user.user_id = auth.uid())))));


create policy "tool_properties_select_policy"
on "public"."tool_properties"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM (tools
     JOIN basejump.account_user ON ((account_user.account_id = tools.account_id)))
  WHERE ((tool_properties.tool_id = tools.id) AND (account_user.user_id = auth.uid())))));


create policy "tool_properties_update_policy"
on "public"."tool_properties"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM (tools
     JOIN basejump.account_user ON ((account_user.account_id = tools.account_id)))
  WHERE ((tool_properties.tool_id = tools.id) AND (account_user.user_id = auth.uid())))));


create policy "Enable delete for users based on user_id"
on "public"."tools"
as permissive
for delete
to authenticated, anon
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Insert New Tool"
on "public"."tools"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Select all tools"
on "public"."tools"
as permissive
for select
to public
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


CREATE TRIGGER trg_update_assistant_tools_updated_at BEFORE UPDATE ON public.assistant_tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_tool_properties_updated_at BEFORE UPDATE ON public.tool_properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_tools_updated_at BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


