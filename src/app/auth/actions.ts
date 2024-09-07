"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createTeam } from "@/lib/actions/teams";

interface data {
  email: string;
  password: string;
  fullName?: string;
  organizationName?: string;
}


export async function login(Data: data) {
  const supabase = createClient();

  console.log(Data);

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: Data.email as string,
    password: Data.password as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return {
      type: "error",
      messages: error.message,
    };
  }

  const { data: teamAccount } = await supabase.rpc("get_accounts");

  const teamAccountFilter = teamAccount.filter(
    (account: any) => account.personal_account === false
  );

  return {
    type: "success",
    slug: teamAccountFilter[0]?.slug,
  };
}

export async function signup(Data: data) {
  const supabase = createClient();

  const { error: errorSignup } = await supabase.auth.signUp({
    email: Data.email,
    password: Data.password,
    options: {
      data: {
        full_name: Data.fullName,
        organization_name: Data.organizationName
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_URL}/auth/confirm?org=${Data.organizationName}&fullName=${Data.fullName}&email=${Data.email}` // URL sin userId
    }
  });

  if (errorSignup) {
    return {
      type: "error",
      messages: errorSignup.message,
    };
  }

  return {
    type: "success",
    message: "Se ha enviado un correo de confirmación. Por favor, verifica tu bandeja de entrada."
  };
}



export async function logout() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/auth/error");
  }

  redirect("/auth");
}

export async function solicitarRecuperacionContrasena(email: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_URL}/change-password`, // URL donde rediriges después de hacer clic en el correo
  });

  if (error) {
    console.error("Error al enviar el correo de recuperación:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function cambiarContrasena(token: string, newPassword: string) {
  // Establece la sesión con el token de recuperación
  const supabase = createClient();
  const { data: session, error: sessionError } = await supabase.auth.setSession({
    access_token: token,
    refresh_token: token,
  });

  if (sessionError) {
    console.error("Error al establecer la sesión:", sessionError.message);
    return { success: false, error: sessionError.message };
  }

  // Cambia la contraseña
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    console.error("Error al cambiar la contraseña:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function handleConfirmation( fullName: string, email: string) {
  const supabase = createClient();

   // Realizar una consulta para obtener el userId usando el email en la tabla users
   const { data: userData, error } = await supabase
   .from('users') // Asegúrate de que esta sea la tabla correcta
   .select('id')
   .eq('email', email)
   .single(); // Obtener un solo registro

 if (error) {
   console.error("Error al obtener el userId:", error.message);
   return { success: false, error: error.message };
 }

 const userId = userData?.id;

  // Insertar en la tabla profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .insert([{ id: userId, full_name: fullName, email: email }]);

  if (profileError) {
    console.error("Error al agregar el perfil:", profileError.message);
    return { success: false, error: profileError.message };
  }

  // Retornar éxito si se inserta el perfil correctamente
  return { success: true };
}