drop policy "Enable read access for all users" on "public"."active_numbers";

alter table "public"."active_numbers" add column "account_id" uuid;

alter table "public"."active_numbers" add constraint "public_active_numbers_account_id_fkey" FOREIGN KEY (account_id) REFERENCES basejump.accounts(id) not valid;

alter table "public"."active_numbers" validate constraint "public_active_numbers_account_id_fkey";

create policy "Enable read access for all users"
on "public"."active_numbers"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));



