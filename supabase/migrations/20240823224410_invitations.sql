alter table "basejump"."invitations" add column "email" text;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION basejump.create_invitation(account_id uuid, account_role text, invitation_type text, email text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$declare
    new_invitation basejump.invitations;
begin
    insert into basejump.invitations (account_id, account_role, invitation_type, invited_by_user_id, email)
    values (account_id, account_role, invitation_type, auth.uid(), email)
    returning * into new_invitation;

    return json_build_object('token', new_invitation.token);
end;$function$
;


drop function if exists "public"."create_invitation"(account_id uuid, account_role basejump.account_role, invitation_type basejump.invitation_type);


