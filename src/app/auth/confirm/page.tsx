'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createTeam } from '@/lib/actions/teams';

export default function ConfirmPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleConfirmation = async () => {
      const organizationName = searchParams.get('org');

      if (organizationName) {
        const formData = new FormData();
        formData.append('name', organizationName);
        
        await createTeam(null, formData);
      }
    };

    handleConfirmation();
  }, [searchParams]);

  return <div>Procesando confirmación...</div>;
}
