create table "public"."document_storage-assistants" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "document_storage" uuid,
    "assistant" uuid
);


CREATE UNIQUE INDEX "document_storage-assistas_pkey" ON public."document_storage-assistants" USING btree (id);

alter table "public"."document_storage-assistants" add constraint "document_storage-assistas_pkey" PRIMARY KEY using index "document_storage-assistas_pkey";

alter table "public"."document_storage-assistants" add constraint "public_document_storage-assistants_assistant_fkey" FOREIGN KEY (assistant) REFERENCES assistants(id) not valid;

alter table "public"."document_storage-assistants" validate constraint "public_document_storage-assistants_assistant_fkey";

alter table "public"."document_storage-assistants" add constraint "public_document_storage-assistants_document-storage_fkey" FOREIGN KEY (document_storage) REFERENCES document_storages(id) not valid;

alter table "public"."document_storage-assistants" validate constraint "public_document_storage-assistants_document-storage_fkey";

grant delete on table "public"."document_storage-assistants" to "anon";

grant insert on table "public"."document_storage-assistants" to "anon";

grant references on table "public"."document_storage-assistants" to "anon";

grant select on table "public"."document_storage-assistants" to "anon";

grant trigger on table "public"."document_storage-assistants" to "anon";

grant truncate on table "public"."document_storage-assistants" to "anon";

grant update on table "public"."document_storage-assistants" to "anon";

grant delete on table "public"."document_storage-assistants" to "authenticated";

grant insert on table "public"."document_storage-assistants" to "authenticated";

grant references on table "public"."document_storage-assistants" to "authenticated";

grant select on table "public"."document_storage-assistants" to "authenticated";

grant trigger on table "public"."document_storage-assistants" to "authenticated";

grant truncate on table "public"."document_storage-assistants" to "authenticated";

grant update on table "public"."document_storage-assistants" to "authenticated";

grant delete on table "public"."document_storage-assistants" to "service_role";

grant insert on table "public"."document_storage-assistants" to "service_role";

grant references on table "public"."document_storage-assistants" to "service_role";

grant select on table "public"."document_storage-assistants" to "service_role";

grant trigger on table "public"."document_storage-assistants" to "service_role";

grant truncate on table "public"."document_storage-assistants" to "service_role";

grant update on table "public"."document_storage-assistants" to "service_role";


