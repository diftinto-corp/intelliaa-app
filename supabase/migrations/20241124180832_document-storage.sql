alter table "public"."document_storages" add column "namespace" text;

alter table "public"."pdf_docs" add column "account_id" uuid;

alter table "public"."pdf_docs" add constraint "public_pdf_docs_account_id_fkey" FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) not valid;

alter table "public"."pdf_docs" validate constraint "public_pdf_docs_account_id_fkey";


