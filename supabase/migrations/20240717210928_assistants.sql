alter table "public"."report_ws" add column "answers" numeric default '0'::numeric;

alter table "public"."report_ws" add column "assistant_id" text;

alter table "public"."report_ws" add column "assistant_name" text;

alter table "public"."report_ws" add column "chat_history" jsonb[];

alter table "public"."report_ws" add column "session_id" text;

alter table "public"."report_ws" add column "user_number" text;

alter table "public"."report_ws" add column "wrong_answers" numeric default '0'::numeric;

create policy "Enable read access for all users"
on "public"."assistants"
as permissive
for select
to anon
using (true);


create policy "Account members can delete"
on "public"."report_ws"
as permissive
for delete
to authenticated
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can insert"
on "public"."report_ws"
as permissive
for insert
to authenticated
with check ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "Account members can update"
on "public"."report_ws"
as permissive
for update
to authenticated
using ((account_id IN ( SELECT basejump.get_accounts_with_role() AS get_accounts_with_role)));


create policy "All logged in users can select"
on "public"."report_ws"
as permissive
for select
to authenticated, anon
using (true);


create policy "Enable insert for authenticated users only"
on "public"."report_ws"
as permissive
for insert
to authenticated, anon
with check (true);


create policy "Update with anon"
on "public"."report_ws"
as permissive
for update
to anon, authenticated
using (true);



