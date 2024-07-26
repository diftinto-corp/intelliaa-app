create policy "Account members can select"
on "public"."assistants"
as permissive
for select
to authenticated
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));



