drop policy "Accounts can be edited by owners" on "basejump"."accounts";

create policy "Accounts can be edited by owners"
on "basejump"."accounts"
as permissive
for update
to authenticated, anon
using ((basejump.has_role_on_account(id, 'owner'::basejump.account_role) = true));



