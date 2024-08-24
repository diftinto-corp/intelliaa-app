"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createTeam } from "@/lib/actions/teams";

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

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: Data.email as string,
    password: Data.password as string,
  };

  const { data: dataSignup, error: errorSignup } = await supabase.auth.signUp(
    data
  );

  if (errorSignup) {
    return {
      type: "error",
      messages: errorSignup.message,
    };
  }

  const { data: teamAccount } = await supabase.rpc("get_accounts");

  const teamAccountFilter = teamAccount.filter(
    (account: any) => account.personal_account === false
  );

  if (teamAccountFilter[0]?.slug) {
    return redirect(`/${teamAccountFilter[0].slug}`);
  }

  const formdata = new FormData();
  formdata.append("name", `${data.email}'s Org`);
  formdata.append("slug", `${data.email}-org`);

  const slug = await createTeam(null, formdata);

  if (slug) {
    return {
      type: "success",
      slug: slug,
    };
  }
}

export async function logout() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/auth/error");
  }

  redirect("/auth");
}
