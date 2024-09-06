"use client";

import { ChangePasswordForm } from "@/components/intelliaa/auth/ChangePasswordForm";
import { Toaster } from "@/components/ui/toaster";

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col w-full h-full justify-center items-center">
      <ChangePasswordForm />
      <Toaster />
    </div>
  );
}