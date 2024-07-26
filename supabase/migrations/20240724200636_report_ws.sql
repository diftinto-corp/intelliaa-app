
drop policy "Account members can delete" on "public"."report_ws";

create policy "Account members can delete"
on "public"."report_ws"
as permissive
for delete
to authenticated, anon
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));



