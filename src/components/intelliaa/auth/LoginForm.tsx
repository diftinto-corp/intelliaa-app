"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { login } from "@/app/auth/actions";
import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "./password-input";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
});

export const LoginForm = ({ onToggleForm }: { onToggleForm: () => void }) => {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setLoading(true);
    const response = await login(values);

    if (response?.type === "error") {
      toast({
        variant: "destructive",
        title: "No se pudo iniciar sesión",
        description: "Por favor, intente de nuevo",
      });
    } else {
      localStorage.setItem("intelliaa-organitation", JSON.stringify(response?.slug));
      router.push(`/${response?.slug}`);
    }
    setLoading(false);
  }

  return (
    <div className='flex flex-col justify-center items-center md:w-[40%] text-center mt-56'>
      <h1 className='text-2xl text-primary font-medium mb-2'>Inicia Sesión</h1>
      <p className='text-muted-foreground text-xs'>
        Ingrese su correo electrónico a continuación para Iniciar sesión.
      </p>
      <Form {...form}>
        <form className='w-full' onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className='mt-6 text-muted-foreground'
                    placeholder='email'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <PasswordInput
                    className='mt-2 text-muted-foreground'
                    placeholder='Contraseña'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-between items-center mt-2 mb-4">
            <Link href="/recovery-password" className="text-primary text-sm">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Button className='mt-4 w-[100%]' type="submit">
            {loading ? (
              <Loader2 size={17} className='animate-spin mr-2' />
            ) : (
              <Mail className='mr-2 h-4 w-4' />
            )}{" "}
            Inicia Sesión
          </Button>
        </form>
      </Form>
      <div className='flex'>
        <span className='text-muted-foreground text-sm mt-6 mr-1'>
          ¿No tienes cuenta?{" "}
        </span>
        <span
          className='text-primary text-sm mt-6 font-bold cursor-pointer'
          onClick={onToggleForm}>
          Regístrate
        </span>
      </div>
      <p className='text-muted-foreground text-xs mt-6'>
        Al hacer clic en continuar, aceptas nuestros Términos de Servicio y
        Política de Privacidad.
      </p>
    </div>
  );
};
