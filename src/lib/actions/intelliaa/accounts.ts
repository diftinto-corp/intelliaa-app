"use server";

import { createClient } from "@/lib/supabase/server";

export async function getAccount() {
  const supabaseClient = createClient();

  const { data, error } = await supabaseClient.rpc("get_accounts");

  if (error) {
    return {
      message: error.message,
    };
  }

  return data[1];
}
