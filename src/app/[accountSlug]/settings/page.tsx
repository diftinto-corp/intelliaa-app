import { use, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Building, Users, CreditCard } from "lucide-react";
import EditPersonalAccountName from "@/components/basejump/edit-personal-account-name";
import { createClient } from "@/lib/supabase/server";
import ManageTeamInvitations from "@/components/basejump/manage-team-invitations";
import ManageTeamMembers from "@/components/basejump/manage-team-members";
import EditTeamSlug from "@/components/basejump/edit-team-slug";
import EditTeamName from "@/components/basejump/edit-team-name";

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
    <div className='flex flex-col w-[98%] rounded-md mt-4 min-h-[90vh] mx-auto p-6 bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'>
      <h1 className='text-3xl font-bold mb-6 text-[hsl(var(--primary))]'>
        Configuración de intelliaa
      </h1>
      <Tabs
        orientation='vertical'
        defaultValue='perfil'
        className='flex flex-col md:flex-row gap-6'>
        <TabsList className='flex flex-col min-h-[200px] bg-[hsl(var(--secondary))] p-2 w-full md:w-64'>
          <TabsTrigger
            value='perfil'
            className='justify-start w-full text-left px-4 py-2  text-[hsl(var(--muted-foreground))] data-[state=active]:bg-teal-900 data-[state=active]:text-[hsl(var(--primary))]'>
            <User className='mr-2 h-4 w-4 inline' />
            Perfil de Usuario
          </TabsTrigger>
          <TabsTrigger
            value='organizacion'
            className='justify-start w-full text-left px-4 py-2 text-[hsl(var(--muted-foreground))] data-[state=active]:bg-teal-900 data-[state=active]:text-[hsl(var(--primary))]'>
            <Building className='mr-2 h-4 w-4 inline' />
            Administrar Organización
          </TabsTrigger>
          <TabsTrigger
            value='miembros'
            className='justify-start w-full text-left px-4 py-2 text-[hsl(var(--muted-foreground))] data-[state=active]:bg-teal-900 data-[state=active]:text-[hsl(var(--primary))]'>
            <Users className='mr-2 h-4 w-4 inline' />
            Administrar Miembros
          </TabsTrigger>
          <TabsTrigger
            value='pagos'
            className='justify-start w-full text-left px-4 py-2 text-[hsl(var(--secondary-foreground))] data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-[hsl(var(--primary-foreground))]'
            disabled>
            <CreditCard className='mr-2 h-4 w-4 inline' />
            Pagos y Facturación
          </TabsTrigger>
        </TabsList>
        <div className='flex-1'>
          <TabsContent value='perfil'>
            <Card className='bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]'>
              <CardHeader>
                <CardTitle className='text-[hsl(var(--primary))]'>
                  Perfil de Usuario
                </CardTitle>
                <CardDescription className='text-[hsl(var(--muted-foreground))]'>
                  Administra tu información personal y preferencias.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EditPersonalAccountName account={teamAccount} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value='organizacion'>
            <Card className='bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]'>
              <CardHeader>
                <CardTitle className='text-[hsl(var(--primary))]'>
                  Administrar Organización
                </CardTitle>
                <CardDescription className='text-[hsl(var(--muted-foreground))]'>
                  Gestiona la configuración de tu organización.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='flex flex-col gap-4'>
                  <EditTeamName account={teamAccount} />
                  <EditTeamSlug account={teamAccount} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value='miembros'>
            <Card className='bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]'>
              <CardHeader>
                <CardTitle className='text-[hsl(var(--primary))]'>
                  Administrar Miembros
                </CardTitle>
                <CardDescription className='text-[hsl(var(--muted-foreground))]'>
                  Gestiona los miembros de tu organización.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='flex flex-col gap-4'>
                  <ManageTeamInvitations accountId={teamAccount.account_id} />
                  <ManageTeamMembers accountId={teamAccount.account_id} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value='pagos'>
            <Card className='bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]'>
              <CardHeader>
                <CardTitle className='text-[hsl(var(--primary))]'>
                  Pagos y Facturación
                </CardTitle>
                <CardDescription className='text-[hsl(var(--muted-foreground))]'>
                  Administra tus métodos de pago y facturación.
                </CardDescription>
              </CardHeader>
              <CardContent></CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
