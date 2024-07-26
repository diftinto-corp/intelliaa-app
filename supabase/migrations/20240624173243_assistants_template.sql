alter table "public"."assistants" add column "template_id" uuid;

alter table "public"."assistants" add constraint "public_assistants_template_id_fkey" FOREIGN KEY (template_id) REFERENCES assistants_template(id) not valid;

alter table "public"."assistants" validate constraint "public_assistants_template_id_fkey";


