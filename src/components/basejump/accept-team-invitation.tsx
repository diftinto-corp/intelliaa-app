"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import Image from "next/image";

export default function AcceptTeamInvitation({ token }: { token: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvitation() {
      const { data, error } = await supabase.rpc("lookup_invitation", {
        lookup_invitation_token: token,
      });

      if (error) {
        setError(error.message);
      } else if (data) {
        setInvitation(data);
      }
      setLoading(false);
    }

    fetchInvitation();
  }, [token, supabase]);

  async function handleAcceptInvitation() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await acceptInvitation();
    } else {
      router.push(`/auth?token=${token}`);
    }
  }

  async function acceptInvitation() {
    const { error } = await supabase.rpc("accept_invitation", {
      invitation_token: token,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push(`/${invitation.account_slug}`);
    }
    setLoading(false);
  }

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (error) {
    return <Alert variant="destructive">{error}</Alert>;
  }

  if (!invitation) {
    return <Alert variant="destructive">Invitación no encontrada o expirada.</Alert>;
  }

  return (
    <Card>
      <CardContent className='p-8 text-center flex flex-col gap-y-8'>
        <div className="mb-6 flex justify-center">
          <Image
            src="/Logo-Intelliaa-Dark.svg"
            alt="Intellia Logo"
            width={150}
            height={50}
            priority
          />
        </div>
        <div>
          <p className='text-sm text-muted-foreground'>
            Has sido invitado para usar Intelliaa
          </p>
          <h1 className='text-xl font-bold text-primary'>
            {invitation.account_name}
          </h1>
        </div>
        {invitation.active ? (
          <Button onClick={handleAcceptInvitation} disabled={loading}>
            {loading ? 'Procesando...' : 'Aceptar invitación'}
          </Button>
        ) : (
          <Alert variant='destructive' className="bg-destructive text-muted-foreground">
            Esta invitación ha sido cancelada. Por favor, pide una nueva invitación.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}