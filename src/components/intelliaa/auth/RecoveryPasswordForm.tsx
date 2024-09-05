"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/use-toast";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import Image from "next/image";
import { solicitarRecuperacionContrasena } from "@/app/auth/actions";

const recoveryPasswordSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
});

export const RecoveryPasswordForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof recoveryPasswordSchema>>({
    resolver: zodResolver(recoveryPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof recoveryPasswordSchema>) {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", values.email);
      
      console.log("Solicitando recuperación de contraseña para:", values.email);
      const result = await solicitarRecuperacionContrasena(values.email);
      console.log("Resultado de la solicitud:", result);
      
      if (result.success) {
        toast({
          title: "Correo enviado",
          description: "Se ha enviado un correo con instrucciones para recuperar tu contraseña.",
        });
        form.reset(); // Limpia el formulario después de un envío exitoso
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Ocurrió un error al procesar la solicitud.",
        });
      }
    } catch (error) {
      console.error("Error al solicitar recuperación de contraseña:", error);
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
      <h1 className='text-2xl text-primary font-medium mb-2'>Recuperar Contraseña</h1>
      <p className='text-muted-foreground text-xs mb-6'>
        Ingresa tu correo electrónico y te enviaremos instrucciones para recuperar tu contraseña.
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
                    placeholder='Correo electrónico'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button className='mt-4 w-[100%]' type="submit" disabled={loading}>
            {loading ? (
              <Loader2 size={17} className='animate-spin mr-2' />
            ) : (
              <Mail className='mr-2 h-4 w-4' />
            )}{" "}
            Enviar instrucciones
          </Button>
        </form>
      </Form>
    </div>
  );
};
