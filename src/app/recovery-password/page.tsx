"use client";

import { RecoveryPasswordForm } from "@/components/intelliaa/auth/RecoveryPasswordForm";
import { Toaster } from "@/components/ui/toaster";

export default function RecuperarContrasenaPage() {
  return (
    <div className="flex flex-col w-full h-full justify-center items-center">
      <RecoveryPasswordForm />
      <Toaster />
    </div>
  );
}
