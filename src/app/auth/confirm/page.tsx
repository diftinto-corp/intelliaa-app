'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createTeam } from '@/lib/actions/teams';


export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const handleConfirmation = async () => {
      // Obtener el token de confirmación de los parámetros de la URL
      const token = searchParams.get('token');
      const organizationName = searchParams.get('org');

      if (!token) {
        console.error("Token de confirmación no proporcionado");
        router.push("/auth");
        return;
      }

      try {
        // Confirmar el registro del usuario con Supabase
        const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'signup' });

        if (error) {
          throw error;
        }

        // Si la confirmación es exitosa y tenemos un nombre de organización, crear el equipo
        if (organizationName) {
          const formData = new FormData();
          formData.append('name', organizationName);
          
          const slug = await createTeam(null, formData);

          if (slug) {
            router.push(`/${slug}`);
          } else {
            router.push("/auth");
          }
        } else {
          router.push("/auth");
        }
      } catch (error) {
        console.error("Error al confirmar el registro:", error);
        router.push("/auth");
      }
    };

    handleConfirmation();
  }, [router, searchParams, supabase]);

  return <div className='flex items-center justify-center h-screen text-muted-foreground'>Confirmando tu cuenta...</div>;
}
