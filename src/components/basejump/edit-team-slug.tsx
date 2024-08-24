"use client";

import { Input } from "@/components/ui/input";
import { SubmitButton } from "../ui/submit-button";
import { editTeamSlug } from "@/lib/actions/teams";
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

type Props = {
  account: GetAccountResponse;
};

export default function EditTeamSlug({ account }: Props) {
  return (
    <Card className='w-[50%]'>
      <CardHeader>
        <CardTitle>Identificador de Organización</CardTitle>
        <CardDescription>
          El identificador de tu organización es único y se utiliza para acceder
          a tu organización
        </CardDescription>
      </CardHeader>
      <form className='animate-in flex-1 text-muted-foreground'>
        <input type='hidden' name='accountId' value={account.account_id} />
        <CardContent className='flex flex-col gap-y-6'>
          <div className='flex flex-col gap-y-2'>
            <Label htmlFor='slug'>Identificador de la organización</Label>
            <div className='flex items-center gap-x-2'>
              <span className='text-sm text-muted-foreground whitespace-nowrap grow'>
                https://your-app.com/
              </span>
              <Input
                defaultValue={account.slug}
                name='slug'
                placeholder='mi-organizacion'
                required
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton formAction={editTeamSlug} pendingText='Actualizando...'>
            Guardar
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
