'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Importamos el componente ConfirmationHandler de forma dinámica
const ConfirmationHandler = dynamic(
  () => import('@/components/intelliaa/ConfirmationHandler'),
  { ssr: false }
);

// Componente principal de la página de confirmación
export default function ConfirmPage() {
  return (
    <div>
      <Suspense fallback={<div>Procesando confirmación...</div>}>
        <ConfirmationHandler />
        <p>Confirmando...</p>
      </Suspense>
    </div>
  );
}


