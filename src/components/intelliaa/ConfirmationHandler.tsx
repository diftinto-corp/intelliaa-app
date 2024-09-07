'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createTeam } from '@/lib/actions/teams';
import { handleConfirmation } from '@/app/auth/actions'; // Asegúrate de que esta función esté exportada

export default function ConfirmationHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleConfirmationProcess = async () => {
      const organizationName = searchParams.get('org'); // Obtener el ID del usuario
      const email = searchParams.get('email'); // Obtener el email del usuario
      const fullName = searchParams.get('userName'); // Obtener el nombre completo del usuario

      if (organizationName &&  email && fullName) {
        const formData = new FormData();
        formData.append('name', organizationName);
        
        // Crear la organización y obtener el resultado
        const teamResult = await createTeam(null, formData);

        // Verificar si el resultado tiene la propiedad 'slug'
        if ('slug' in teamResult) {
          // Llamar a la función para manejar la confirmación
          const confirmationResult = await handleConfirmation(fullName, email);
          if (!confirmationResult.success) {
            console.error("Error al manejar la confirmación:", confirmationResult.error);
          }
        }
      }
    };

    handleConfirmationProcess();
  }, [searchParams]);

  return (
    <div>
      <p>Confirmando...</p>
    </div>
  )
}
