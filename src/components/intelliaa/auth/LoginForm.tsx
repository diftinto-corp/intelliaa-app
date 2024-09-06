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
import { acceptInvitation } from "@/app/auth/actions";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
});

type LoginFormProps = {
  onToggleForm: () => void;
  onSuccess: () => void;
  invitationToken?: string | null;
};

export const LoginForm = ({ onToggleForm, onSuccess, invitationToken }: LoginFormProps) => {
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
    try {
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("password", values.password);
      if (invitationToken) {
        formData.append("invitationToken", invitationToken);
      }
      
      const response = await login(null, formData);
      
      if (response.success) {
        if (invitationToken) {
          // Si hay un token de invitación, aceptamos la invitación después del login
          try {
            await acceptInvitation(invitationToken);
          } catch (error) {
            console.error("Error al aceptar la invitación:", error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "No se pudo aceptar la invitación. Por favor, intenta de nuevo.",
            });
          }
        }
        onSuccess();
        // Verificamos si response tiene la propiedad slug antes de usarla
        if ('slug' in response) {
          router.push(`/${response.slug}`);
        } else {
          // Si no hay slug, redirigimos a una ruta por defecto
          router.push('/dashboard');
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error de inicio de sesión",
          description: response.message || "Por favor, intente de nuevo",
        });
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ocurrió un error inesperado. Por favor, intenta de nuevo más tarde.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className='mt-6 text-muted-foreground'
                  placeholder='Correo electrónico'
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" /> Iniciar sesión
            </>
          )}
        </Button>
      </form>
      <p className='mt-4 text-sm'>
        ¿No tienes una cuenta?{" "}
        <Link href="/register" passHref>
          <button type="button" className="text-primary">
            Regístrate
          </button>
        </Link>
      </p>
    </Form>
  );
}
