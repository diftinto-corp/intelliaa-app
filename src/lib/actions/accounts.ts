"use server";

import { createClient } from "../supabase/server";

export async function getAccountBySlug(prevState: any, accountSlug: string) {
  const supabase = await createClient();

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

/**
 * Get account ID from account slug
 * Used for master-detail layout to resolve slug to account_id
 *
 * @param accountSlug - The account slug from URL
 * @returns Account ID or null if not found
 */
export async function getAccountIdFromSlug(
  accountSlug: string
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_account_by_slug", {
    slug: accountSlug,
  });

  if (error) {
    console.error("[getAccountIdFromSlug] Error:", error);
    return null;
  }

  // The RPC returns the account object with account_id
  return data?.account_id || null;
}
