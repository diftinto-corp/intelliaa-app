'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createTeam } from '@/lib/actions/teams';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';




export default function ConfirmationHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  useEffect(() => {
    const confirmUserAndCreateOrganization = async () => {
      const accessToken = searchParams.get('token'); // Obtener el token de la URL
      const email = searchParams.get('email'); // Obtener el correo electrónico de la URL

      if (!accessToken || !email) {
        console.error("No se proporcionó un token de acceso o un correo electrónico.");
        setLoading(false);
        return;
      }

      // Verificar el token de confirmación de Supabase
      const { error: verifyError } = await supabase.auth.verifyOtp({ token: accessToken, type: 'signup', email: email });

      if (verifyError) {
        console.error("Error verificando el token:", verifyError);
        setLoading(false);
        return;
      }

      // Obtener el usuario después de la verificación
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (user) {
        const organizationName = searchParams.get('org'); // Obtener el nombre de la organización de la URL
        const formData = new FormData();
        formData.append('name', organizationName || 'Nueva organización'); // Usar un nombre por defecto si no se proporciona

        // Crear la organización
        await createTeam(null, formData); // La redirección se maneja dentro de createTeam
      } else {
        console.error("No se pudo obtener el usuario.");
      }

      setLoading(false);
    };

    confirmUserAndCreateOrganization();
  }, [searchParams, router]);

  if (loading) {
    return <div>Cargando...</div>;
  }

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
            {loading ? 'Corfirmando' : 'Ha sido confirmada tu cuenta, Gracias por usar Intelliaa'}
          </p>
          
        </div>
       
      </CardContent>
    </Card>
}
