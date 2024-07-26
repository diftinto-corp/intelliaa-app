import { Input } from "@/components/ui/input";
import { SubmitButton } from "../ui/submit-button";
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
        <CardTitle>Your info</CardTitle>
        <CardDescription>
          Your name is used on your personal profile as well as in your teams
        </CardDescription>
      </CardHeader>
      <form className='animate-in flex-1 text-foreground'>
        <input
          type='hidden'
          name='accountId'
          value={personalAccount.account_id}
        />
        <CardContent className='flex flex-col gap-y-6'>
          <div className='flex flex-col gap-y-2'>
            <Label htmlFor='name'>Name</Label>
            <Input
              defaultValue={personalAccount.name}
              name='name'
              placeholder='Marty Mcfly'
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton
            formAction={editPersonalAccountName}
            pendingText='Updating...'>
            Save
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
