CREATE UNIQUE INDEX pdf_docs_pkey ON public.pdf_docs USING btree (id);

alter table "public"."pdf_docs" add constraint "pdf_docs_pkey" PRIMARY KEY using index "pdf_docs_pkey";


