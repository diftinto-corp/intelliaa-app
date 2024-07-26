import Dashboard from "@/components/intelliaa/common/dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PersonalAccountDashboard({
  children,
  params: { accountSlug },
}: {
  children: React.ReactNode;
  params: { accountSlug: string };
}) {
  const supabaseClient = createClient();

  const { data: teamAccount, error } = await supabaseClient.rpc(
    "get_account_by_slug",
    {
      slug: accountSlug,
    }
  );

  if (!teamAccount) {
    redirect("/auth");
  }

  return <Dashboard accountSlug={accountSlug}>{children}</Dashboard>;
}
