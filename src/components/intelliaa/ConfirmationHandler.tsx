'use client';

import { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams, useRouter } from 'next/navigation';
import { createTeam } from '@/lib/actions/teams';
import { handleConfirmation } from '@/app/auth/actions'; 
import Image from "next/image";

export default function ConfirmationHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleConfirmationProcess = async () => {
      const organizationName = searchParams.get('org'); // Obtener el ID del usuario
      const email = searchParams.get('email'); // Obtener el email del usuario
      const fullName = searchParams.get('fullName'); // Obtener el nombre completo del usuario

      if (organizationName && email && fullName) {
        const formData = new FormData();
        formData.append('name', organizationName);
        
        try {
          // Crear la organización y obtener el resultado
          const teamResult = await createTeam(null, formData);
          console.log(teamResult.slug) 

          // Verificar si el resultado tiene la propiedad 'slug'
          if ('slug' in teamResult) {
            // Llamar a la función para manejar la confirmación
            const confirmationResult = await handleConfirmation(fullName, email);
            if (confirmationResult.success) {
              console.log("Redirigiendo a:", teamResult.slug); // Para depuración
              router.push(`/${teamResult.slug}`);
            } else {
              console.error("Error al manejar la confirmación:", confirmationResult.error);
            }
          }
        } catch (error) {
          console.error("Error en el proceso de confirmación:", error);
        }
      }
    };

    handleConfirmationProcess();
  }, [searchParams, router]);

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
          
          <h3 className='text-xl font-bold text-primary'>
            Confirmando...
          </h3>
        </div>
        
      </CardContent>
    </Card>

  )
}
