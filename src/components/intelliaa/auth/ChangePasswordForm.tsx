"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/use-toast";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "./password-input";
import { cambiarContrasena } from "@/app/auth/actions";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";

const changePasswordSchema = z.object({
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const ChangePasswordForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof changePasswordSchema>) {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Token de recuperación no válido.",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await cambiarContrasena(token, values.password);
      
      if (result.success) {
        toast({
          title: "Contraseña cambiada",
          description: "Tu contraseña ha sido cambiada exitosamente.",
        });
        router.push("/login"); // Redirige al usuario a la página de inicio de sesión
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Ocurrió un error al cambiar la contraseña.",
        });
      }
    } catch (error) {
      console.error("Error al cambiar la contraseña:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado al cambiar la contraseña.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='flex flex-col justify-center items-center md:w-[20%] text-center mt-56'>
      <div className="mb-6">
        <Image
          src="/Logo-Intelliaa-Dark.svg"
          alt="Intellia Logo"
          width={150}
          height={50}
          priority
        />
      </div>
      <h1 className='text-2xl text-primary font-medium mb-2'>Cambiar Contraseña</h1>
      <p className='text-muted-foreground text-xs mb-6'>
        Ingresa tu nueva contraseña.
      </p>
      <Form {...form}>
        <form className='w-full' onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <PasswordInput
                    className='mt-2 text-muted-foreground'
                    placeholder='Nueva contraseña'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <PasswordInput
                    className='mt-2 text-muted-foreground'
                    placeholder='Confirmar nueva contraseña'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button className='mt-4 w-[100%]' type="submit">
            {loading ? (
              <Loader2 size={17} className='animate-spin mr-2' />
            ) : (
              <Lock className='mr-2 h-4 w-4' />
            )}{" "}
            Cambiar Contraseña
          </Button>
        </form>
      </Form>
    </div>
  );
};
