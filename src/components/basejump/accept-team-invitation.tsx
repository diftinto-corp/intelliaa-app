import { acceptInvitation } from "@/lib/actions/invitations";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "../ui/alert";
import { Card, CardContent } from "../ui/card";
import { SubmitButton } from "../ui/submit-button";
import { Input } from "../ui/input";
import { redirect } from "next/navigation";

type Props = {
  token: string;
  email: string;
};
export default async function AcceptTeamInvitation({ token, email }: Props) {
  const supabaseClient = createClient();
  const { data: invitation } = await supabaseClient.rpc("lookup_invitation", {
    lookup_invitation_token: token,
  });

  console.log(invitation);

  if (!invitation) {
    redirect(`/auth-invitation?token=${token}&email=${email}`);
  }

  return (
    <Card>
      <CardContent className='p-8 text-center flex flex-col gap-y-8'>
        <div>
          <p className='text-sm text-muted-foreground'>
            Haz sido invitado para usar Intelliaa
          </p>
          <h1 className='text-xl font-bold text-primary'>
            {invitation.account_name}
          </h1>
        </div>
        {Boolean(invitation.active) ? (
          <form>
            <Input
              className='text-muted-foreground'
              type='hidden'
              name='token'
              value={token}
            />
            <SubmitButton
              formAction={acceptInvitation}
              pendingText='Aceptando invitación...'>
              Aceptar invitación
            </SubmitButton>
          </form>
        ) : (
          <Alert variant='destructive'>
            Esta invitación ha sido cancelada. Por favor, pide una nueva
            invitación.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
