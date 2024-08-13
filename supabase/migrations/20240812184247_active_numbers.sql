drop policy "Enable read access for all users" on "public"."active_numbers";

create policy "Enable read access for all users"
on "public"."active_numbers"
as permissive
for select
to authenticated
using (true);



