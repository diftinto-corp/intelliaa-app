create policy "Delete Assistant by account_id"
on "public"."assistants"
as permissive
for delete
to authenticated, anon
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));



