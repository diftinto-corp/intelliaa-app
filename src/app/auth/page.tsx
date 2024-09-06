"use client";

import { LoginForm } from "@/components/intelliaa/auth/LoginForm";
import { RegisterForm } from "@/components/intelliaa/auth/RegisterForm";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setInvitationToken(token);
      checkInvitation(token);
    }
  }, [searchParams]);

  async function checkInvitation(token: string) {
    const { data, error } = await supabase.rpc("lookup_invitation", {
      lookup_invitation_token: token,
    });

    if (data && !data.user_id) {
      setIsLogin(false); // Mostrar formulario de registro
    } else {
      setIsLogin(true); // Mostrar formulario de login
    }
  }

  const toggleForm = () => {
    setIsLogin(!isLogin);
  };

  const onAuthSuccess = async (token: string | null) => {
    if (token) {
      const { error } = await supabase.rpc("accept_invitation", {
        invitation_token: token,
      });
      if (!error) {
        router.push('/'); // O a donde quieras redirigir después de aceptar la invitación
      }
    } else {
      router.push('/');
    }
  };

  return (
    <>
      <div className='flex items-center justify-center w-full p-4'>
        <div className='flex self-start w-full'>
          <Link href='/'>
            <Image
              src='/Logo-Intelliaa-Dark.svg'
              alt='Image'
              width='140'
              height='60'
              className=''
            />
          </Link>
        </div>
      </div>

      {isLogin ? (
        <LoginForm onToggleForm={toggleForm} onSuccess={() => onAuthSuccess(invitationToken)} />
      ) : (
        <RegisterForm onToggleForm={toggleForm} onSuccess={() => onAuthSuccess(invitationToken)} invitationToken={invitationToken} />
      )}
    </>
  );
}
