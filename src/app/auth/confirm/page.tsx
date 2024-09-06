'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createTeam } from '@/lib/actions/teams';

export default function ConfirmPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleConfirmation = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('full_name, organization_name')
          .eq('id', user.id)
          .single();

        if (userData) {
          const organizationSlug = userData.organization_name.toLowerCase().replace(/\s+/g, '-');

          const formdata = new FormData();
          formdata.append("name", userData.organization_name);
          formdata.append("slug", organizationSlug);

          const slug = await createTeam(null, formdata);

          if (slug) {
            await supabase
              .from('profiles')
              .upsert({ id: user.id, full_name: userData.full_name });

            router.push(`/${slug}`);
          } else {
            // Manejar error en la creación de la organización
          }
        }
      } else {
        // Manejar el caso en que no hay usuario autenticado
      }
    };

    handleConfirmation();
  }, []);

  return <div>Confirmando tu cuenta...</div>;
}
