alter table "public"."active_numbers" alter column "is_active" set default false;

alter table "public"."active_numbers" disable row level security;


