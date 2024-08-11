drop policy "Policy with table joins" on "public"."active_numbers";

alter table "public"."active_numbers" enable row level security;

create policy "Policy with table joins"
on "public"."active_numbers"
as permissive
for update
to authenticated, anon
using (true);



