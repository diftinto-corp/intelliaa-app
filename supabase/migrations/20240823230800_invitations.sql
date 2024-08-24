set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_invitation(account_id uuid, account_role basejump.account_role, invitation_type basejump.invitation_type, email text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$DECLARE
    new_invitation basejump.invitations;
BEGIN
    INSERT INTO basejump.invitations (account_id, account_role, invitation_type, invited_by_user_id, email)
    VALUES (account_id, account_role, invitation_type, auth.uid(), email)
    RETURNING * INTO new_invitation;

    RETURN json_build_object('token', new_invitation.token);
END;$function$
;


