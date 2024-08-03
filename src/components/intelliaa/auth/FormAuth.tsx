"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { login, signup } from "@/app/auth/actions";
import React, { useState } from "react";
import { BsGoogle } from "react-icons/bs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/ui/use-toast";

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

export const FormAuth = () => {
  const { toast } = useToast();

  const [isRegister, setIsRegister] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isRegister) {
      setLoading(true);
      const response = await signup(values);

      if (response) {
        console.log(response);
        toast({
          variant: "destructive",
          title: "No se pudo registrar",
          description: "Por favor, intente de nuevo",
        });
      }

      setLoading(false);
    }

    if (isRegister) {
      setLoading(true);
      const response = await login(values);
      if (response) {
        console.log(response);
        toast({
          variant: "destructive",
          title: "No se pudo iniciar sesión",
          description: "Por favor, intente de nuevo",
        });
      }
      setLoading(false);
    }
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
  }

  return (
    <>
      {isRegister && (
        <div className='flex flex-col justify-center items-center md:w-[40%] text-center mt-56 '>
          <h1 className=' text-2xl text-primary font-medium mb-2'>
            Inicia Sesión
          </h1>
          <p className='text-muted-foreground text-xs'>
            Ingrese su correo electrónico a continuación para Iniciar sesión.
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
                        <Input
                          className='mt-6 text-muted-foreground'
                          placeholder='email'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem>
                      <FormControl>
                        <PasswordInput
                          className='mt-2 text-muted-foreground'
                          placeholder='Contraseña'
                          {...form.register("password")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </>
                )}
              />
              <Button className=' mt-4 w-[100%]'>
                {loading ? (
                  <Loader2 size={17} className='animate-spin mr-2' />
                ) : (
                  <Mail className='mr-2 h-4 w-4' />
                )}{" "}
                Inicia Sesión
              </Button>
            </form>
          </Form>
          {/* <p className='text-xs mt-6'>ó puedes continuar con:</p>
          <Button className=' border bg-white text-primary mt-6 w-[100%] hover:text-white'>
            <BsGoogle className='mr-2 h-4 w-4' /> Login con Google
          </Button> */}

          <div className='flex '>
            <span className='text-muted-foreground text-sm mt-6 mr-1'>
              ¿No tienes cuenta?{" "}
            </span>
            <span
              className='text-primary text-sm mt-6 font-bold cursor-pointer'
              onClick={() => setIsRegister(!isRegister)}>
              Regitrate
            </span>
          </div>
          <p className='text-muted-foreground text-xs mt-6'>
            Al hacer clic en continuar, aceptas nuestros Términos de Servicio y
            Política de Privacidad.
          </p>
        </div>
      )}
      {!isRegister && (
        <div className='flex flex-col justify-center items-center md:w-[40%] text-center mt-56'>
          <h1 className=' text-2xl text-primary font-medium mb-2'>
            Crea una cuenta
          </h1>
          <p className='text-muted-foreground text-xs'>
            Ingrese su correo electrónico a continuación para crear su cuenta.
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
                        <Input
                          className='mt-6 text-muted-foreground'
                          placeholder='email'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem>
                      <FormControl>
                        <PasswordInput
                          className='mt-2 text-muted-foreground'
                          placeholder='Contraseña'
                          {...form.register("password")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </>
                )}
              />
              <Button className=' mt-4 w-[100%]'>
                {loading ? (
                  <Loader2 size={17} className='animate-spin mr-2' />
                ) : (
                  <Mail className='mr-2 h-4 w-4' />
                )}
                Registrate
              </Button>
            </form>
          </Form>
          {/* <p className='text-xs mt-6'>ó puedes continuar con:</p>
          <Button className=' border bg-white text-primary mt-6 w-[100%] hover:text-white'>
            <BsGoogle className='mr-2 h-4 w-4' /> Registrar con Google
          </Button> */}

          <div className='flex '>
            <span className='text-muted-foreground text-sm mt-6 mr-1'>
              Ya tienes cuenta{" "}
            </span>
            <span
              className='text-primary text-sm mt-6 font-bold cursor-pointer'
              onClick={() => setIsRegister(!isRegister)}>
              Inicia Sesión
            </span>
          </div>
          <p className='text-muted-foreground text-xs mt-6'>
            Al hacer clic en continuar, aceptas nuestros Términos de Servicio y
            Política de Privacidad.
          </p>
        </div>
      )}
    </>
  );
};
