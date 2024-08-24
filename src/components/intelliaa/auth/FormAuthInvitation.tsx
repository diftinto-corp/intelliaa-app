"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { login, signup } from "@/app/auth/actions";
import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/ui/use-toast";
import { useRouter, useParams } from "next/navigation";
import { acceptInvitation } from "@/lib/actions/invitations";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "./password-input";


const formSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long" }),
});

export const FormAuthInvitation = ({ token }: { token: string }) => {
  const params = useParams<{ token: string }>();

  console.log(token);

  const router = useRouter();
  const { toast } = useToast();

  const [isRegister, setIsRegister] = useState(true);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);

    const formdata = new FormData();
    formdata.append("token", token);

    const response = isRegister ? await login(values) : await signup(values);

    // Set loading to false on error

    if (response?.type === "error") {
      toast({
        variant: "destructive",
        title: isRegister
          ? "No se pudo iniciar sesión"
          : "No se pudo registrar",
        description: "Por favor, intente de nuevo",
      });
      setLoading(false); // Set loading to false on error
    } else {
      localStorage.setItem(
        "intelliaa-organization",
        JSON.stringify(response?.slug || response)
      );
      setLoading(false); // Set loading to false before redirection
      await acceptInvitation(params, formdata);
    }
  }

  return (
    <div className='flex flex-col justify-center items-center md:w-[40%] text-center mt-56'>
      <h1 className='text-2xl text-primary font-medium mb-2'>
        {isRegister
          ? "Haz recibido una invitación inicia sesión para aceptarla"
          : "Haz recibido una invitación regístrate para aceptarla"}
      </h1>
      <p className='text-foreground text-xs'>
        {isRegister
          ? "Ingrese su correo electrónico a continuación para Iniciar sesión. Para aceptar la invitación."
          : "Ingrese su correo electrónico a continuación para crear su cuenta. Para aceptar la invitación."}
      </p>
      <Form {...form}>
        <form className='w-full' onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <>
                <FormItem>
                  <FormControl>
                    <Input className='mt-6' placeholder='email' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem>
                  <FormControl>
                    <PasswordInput
                      className='mt-2'
                      placeholder='Contraseña'
                      {...form.register("password")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </>
            )}
          />
          <Button className='mt-2 w-[100%]'>
            {loading ? (
              <Loader2 size={17} className='animate-spin mr-2' />
            ) : (
              <Mail className='mr-2 h-4 w-4' />
            )}
            {isRegister ? "Inicia Sesión" : "Regístrate"}
          </Button>
        </form>
      </Form>
      <div className='flex'>
        <span className='text-foreground text-sm mt-6 mr-1'>
          {isRegister ? "¿No tienes cuenta?" : "Ya tienes cuenta"}
        </span>
        <span
          className='text-primary text-sm mt-6 font-bold cursor-pointer'
          onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "Regístrate" : "Inicia Sesión"}
        </span>
      </div>
      <p className='text-foreground text-xs mt-6'>
        Al hacer clic en continuar, aceptas nuestros Términos de Servicio y
        Política de Privacidad.
      </p>
    </div>
  );
};
