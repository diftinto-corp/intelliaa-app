create policy "Enable read access for all users"
on "public"."voice_assistant"
as permissive
for select
to anon
using (true);



