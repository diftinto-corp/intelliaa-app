import { createClient } from "@/lib/supabase/server";

export async function updateUserPassword(email: string, newPassword: string) {
  const supabase = await createClient();
  console.log("Actualizando contraseña para:", email);

  const { data, error } = await supabase.auth.admin.updateUserById(
    email,
    { password: newPassword }
  );

  if (error) {
    console.error("Error al actualizar la contraseña:", error);
    throw new Error("No se pudo actualizar la contraseña");
  }

  console.log("Contraseña actualizada exitosamente");
  return data;
}
