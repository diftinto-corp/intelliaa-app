'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createTeam } from '@/lib/actions/teams';
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

export default function ConfirmationHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleConfirmationProcess = async () => {
      const organizationName = searchParams.get('org');
      const email = searchParams.get('email');
      const fullName = searchParams.get('fullName');

      if (organizationName && email && fullName) {
        const formData = new FormData();
        formData.append('name', organizationName);
        
        try {
          // Crear la organización y obtener el resultado
          await createTeam(null, formData);
          // La redirección se maneja dentro de createTeam
        } catch (error) {
          console.error("Error en el proceso de confirmación:", error);
        }
      }
    };

    handleConfirmationProcess();
  }, [searchParams]);

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
  );
}
