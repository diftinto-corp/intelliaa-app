create policy "Account members can insert"
on "public"."assistants"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));



