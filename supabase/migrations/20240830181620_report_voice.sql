create policy "Enable insert for authenticated users only"
on "public"."report_voice"
as permissive
for insert
to anon
with check (true);


create policy "Enable read access for all users"
on "public"."report_voice"
as permissive
for select
to anon, authenticated
using (true);



