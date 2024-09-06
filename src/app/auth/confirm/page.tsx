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
      
      const organizationName = searchParams.get('org');

      

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

    };

    handleConfirmation();
  }, [router, searchParams, supabase]);

  return <div className='flex items-center justify-center h-screen text-muted-foreground'>Confirmando tu cuenta...</div>;
}
