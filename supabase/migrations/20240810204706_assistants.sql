alter table "public"."assistants" add column "active_number" uuid;

alter table "public"."assistants" add constraint "public_assistants_active_number_fkey" FOREIGN KEY (active_number) REFERENCES active_numbers(id) not valid;

alter table "public"."assistants" validate constraint "public_assistants_active_number_fkey";


