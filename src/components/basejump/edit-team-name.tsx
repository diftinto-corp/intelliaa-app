import { Input } from "@/components/ui/input";
import { SubmitButton } from "../ui/submit-button";
import { editTeamName } from "@/lib/actions/teams";
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

export default function EditTeamName({ account }: Props) {
  return (
    <Card className='w-[50%]'>
      <CardHeader>
        <CardTitle>Organización</CardTitle>
        <CardDescription>Cambia el nombre de tu organización.</CardDescription>
      </CardHeader>
      <form className='animate-in flex-1 text-muted-foreground'>
        <input type='hidden' name='accountId' value={account.account_id} />
        <CardContent className='flex flex-col gap-y-6'>
          <div className='flex flex-col gap-y-2'>
            <Label htmlFor='name'>Nombre de organización</Label>
            <Input
              defaultValue={account.name}
              name='name'
              placeholder='My Team'
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton formAction={editTeamName} pendingText='Updating...'>
            Guardar
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
