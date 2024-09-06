import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ChangePasswordForm = dynamic(
  () => import('@/components/intelliaa/auth/ChangePasswordForm'),
  { ssr: false }
);

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col w-full h-full justify-center items-center">
      <Suspense fallback={<div>Cargando...</div>}>
        <ChangePasswordForm />
      </Suspense>
    </div>
  );
}