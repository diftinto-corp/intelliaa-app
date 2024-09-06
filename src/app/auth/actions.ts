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

  const { data: dataSignup, error: errorSignup } = await supabase.auth.signUp({
    email: Data.email,
    password: Data.password,
    options: {
      data: {
        full_name: Data.fullName,
        organization_name: Data.organizationName
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_URL}/auth` // URL para redirigir después de confirmar el correo
    }
  });

  if (errorSignup) {
    return {
      type: "error",
      messages: errorSignup.message,
    };
  }

  const organizationSlug = Data.organizationName?.toLowerCase().replace(/\s+/g, '-');

  const formdata = new FormData();
  formdata.append("name", Data.organizationName ?? '');
  formdata.append("slug", organizationSlug ?? '');

  const slug = await createTeam(null, formdata);

  if (slug) {
    // Actualizar el perfil del usuario con el nombre completo
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: Data.fullName })
      .eq('id', dataSignup.user?.id);

    if (profileError) {
      console.error('Error al actualizar el perfil:', profileError);
    }

    return {
      type: "success",
      slug: slug,
      message: "Se ha enviado un correo de confirmación. Por favor, verifica tu bandeja de entrada."
    };
  }

  return {
    type: "error",
    messages: "Error al crear la organización",
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
