"use server";

import { createClient } from "../supabase/server";

export async function getAccountBySlug(prevState: any, accountSlug: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_account_by_slug", {
    slug: accountSlug,
  });

  if (error) {
    return {
      message: error.message,
    };
  }

  return data;
}
