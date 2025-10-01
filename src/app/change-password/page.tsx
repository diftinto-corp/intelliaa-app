import { Suspense } from 'react';
import ChangePasswordForm from '@/components/intelliaa/auth/ChangePasswordForm';

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col w-full h-full justify-center items-center">
      <Suspense fallback={<div>Cargando...</div>}>
        <ChangePasswordForm />
      </Suspense>
    </div>
  );
}