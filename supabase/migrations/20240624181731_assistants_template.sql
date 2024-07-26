create policy "Enable insert for authenticated users only"
on "public"."assistants"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for all users"
on "public"."assistants_template"
as permissive
for select
to public
using (true);



