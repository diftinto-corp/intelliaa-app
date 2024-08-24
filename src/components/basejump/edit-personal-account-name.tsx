import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label } from "../ui/label";
import { GetAccountResponse } from "@usebasejump/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { editPersonalAccountName } from "@/lib/actions/personal-account";
import { createClient } from "@/lib/supabase/server";

type Props = {
  account: GetAccountResponse;
};

export default async function EditPersonalAccountName({ account }: Props) {
  const supabaseClient = createClient();
  const { data: personalAccount } = await supabaseClient.rpc(
    "get_personal_account"
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu Perfil</CardTitle>
        <CardDescription>
          Actualiza la información de tu cuenta.
        </CardDescription>
      </CardHeader>
      <form className='animate-in flex-1 text-foreground'>
        <input
          type='hidden'
          name='accountId'
          value={personalAccount.account_id}
        />
        <CardContent className='flex flex-col gap-y-6'>
          <div className='flex flex-col gap-y-2 text-muted-foreground'>
            <Label htmlFor='name'>Tu Nombre</Label>
            <Input
              defaultValue={personalAccount.name}
              name='Nombre'
              placeholder='Marty Mcfly'
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton
            formAction={editPersonalAccountName}
            pendingText='Actualizar...'>
            Guardar
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
