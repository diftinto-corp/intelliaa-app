// pages/unsupported.tsx
import Link from "next/link";
import React from "react";

const Unsupported: React.FC = () => {
  return (
    <div className='flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-md text-center'>
        <div className='mx-auto h-12 w-12 text-primary' />
        <h1 className='mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-muted-foreground '>
          Dispositivo No Soportado
        </h1>
        <p className='mt-4 text-muted-foreground'>
          Lo sentimos, nuestra aplicación no es compatible con dispositivos
          tablets, móviles y pantallas con resolución inferior a 1080px. Para
          una mejor experiencia, por favor accede desde un dispositivo con una
          resolución de pantalla mayor.
        </p>
        <div className='mt-6'>
          <Link
            href='/'
            className='inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
            prefetch={false}>
            Ir a la Página Principal
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unsupported;
