import EditPersonalAccountName from "@/components/basejump/edit-personal-account-name";
import EditTeamName from "@/components/basejump/edit-team-name";
import EditTeamSlug from "@/components/basejump/edit-team-slug";
import ManageTeamInvitations from "@/components/basejump/manage-team-invitations";
import ManageTeamMembers from "@/components/basejump/manage-team-members";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function TeamSettingsPage({
  params: { accountSlug },
}: {
  params: { accountSlug: string };
}) {
  console.log(accountSlug);
  const supabaseClient = createClient();
  const { data: teamAccount } = await supabaseClient.rpc(
    "get_account_by_slug",
    {
      slug: accountSlug,
    }
  );

  return (
    <div className='flex flex-col gap-y-8 p-8 min-h-[93vh]'>
      {/* <EditPersonalAccountName account={teamAccount} />
      <EditTeamName account={teamAccount} />
      <EditTeamSlug account={teamAccount} /> */}
      <Tabs defaultValue='profile' orientation='vertical'>
        <TabsList>
          <TabsTrigger value='profile'>Perfil de usuario</TabsTrigger>
          <TabsTrigger value='organitation'>Organización</TabsTrigger>
          <TabsTrigger value='members'>Miembros</TabsTrigger>
        </TabsList>
        <TabsContent value='profile'>
          <div className='flex flex-col gap-4'>
            <EditPersonalAccountName account={teamAccount} />
          </div>
        </TabsContent>
        <TabsContent value='organitation'>
          <div className='flex flex-col gap-4'>
            <EditTeamName account={teamAccount} />
            <EditTeamSlug account={teamAccount} />
          </div>
        </TabsContent>
        <TabsContent value='members'>
          <div className='flex flex-col gap-4'>
            <ManageTeamInvitations accountId={teamAccount.account_id} />
            <ManageTeamMembers accountId={teamAccount.account_id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
