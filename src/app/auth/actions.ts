"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

interface data {
  email: string;
  password: string;
}

export async function login(Data: data) {
  const supabase = createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: Data.email as string,
    password: Data.password as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    console.log(error.message);
    return error.message;
  }

  const { data: teamAccount } = await supabase.rpc("get_accounts");

  const teamAccountFilter = teamAccount.filter(
    (account: any) => account.personal_account === false
  );

  return redirect(
    teamAccountFilter[0]?.slug ? `/${teamAccountFilter[0]?.slug}` : "/tenant"
  );
}

export async function signup(Data: data) {
  const supabase = createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: Data.email as string,
    password: Data.password as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    console.log(error);
    return {
      messages: error.message,
      error: true,
    };
  }

  const { data: teamAccount } = await supabase.rpc("get_accounts");

  const teamAccountFilter = teamAccount.filter(
    (account: any) => account.personal_account === false
  );

  return redirect(
    teamAccountFilter[0]?.slug ? `/${teamAccountFilter[0]?.slug}` : "/tenant"
  );
}

export async function logout() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/auth/error");
  }

  redirect("/auth");
}
