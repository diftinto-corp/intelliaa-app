import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import NewTeamForm from "@/components/basejump/new-team-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TenantFrom({
  params: { accountSlug },
}: {
  params: { accountSlug: string };
}) {
  const supabaseClient = await createClient();

  const { data: teamAccount } = await supabaseClient.rpc("get_accounts");

  if (!teamAccount || teamAccount.length === 0 || null) {
    redirect("/auth");
  }
  if (teamAccount[0]?.slug) {
    redirect(`/${teamAccount[0]?.slug}`);
  }

  return (
    <main className='flex flex-col items-center justify-center min-h-screen'>
      <Card className='mx-auto max-w-sm'>
        <CardHeader>
          <CardTitle className='text-xl'>Create Tenant</CardTitle>
          <CardDescription>
            Create a new tenant account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewTeamForm />
        </CardContent>
      </Card>
    </main>
  );
}
