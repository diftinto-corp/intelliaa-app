'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createTeam } from '@/lib/actions/teams';
import { handleConfirmation } from '@/app/auth/actions';

export default function ConfirmationHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleConfirmationProcess = async () => {
      const organizationName = searchParams.get('org');
      

      if (organizationName) {
        const formData = new FormData();
        formData.append('name', organizationName);
        
        try {
          // Crear la organización y obtener el resultado
          await createTeam(null, formData);

        } catch (error) {
          console.error("Error en el proceso de confirmación:", error);
        }
      }
    };

    handleConfirmationProcess();
  }, [searchParams, router]);

  return (
    <div>
      <p>Confirmando...</p>
    </div>
  );
}
