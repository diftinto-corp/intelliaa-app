"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createInvitation(
  prevState: any,
  formData: FormData
): Promise<{ token?: string; message: string }> {
  const invitationType = formData.get("invitationType") as string;
  const accountId = formData.get("accountId") as string;
  const accountRole = formData.get("accountRole") as string;
  const email = formData.get("email") as string;
  const organizationName = formData.get("accountName") as string;

  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_invitation", {
    account_id: accountId,
    invitation_type: invitationType,
    account_role: accountRole,
    email: email,
  });

  if (error) {
    return {
      message: `Error creating invitation: ${error.message}`,
    };
  }

  const invitationUrl = `${process.env.NEXT_PUBLIC_URL}/auth?token=${data.token}`;

  const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      invitation_token: data.token,
      account_id: accountId,
      account_name: organizationName,
      account_role: accountRole,
    },
    redirectTo: invitationUrl,
  });

  if (emailError) {
    return {
      message: `Error sending invitation email: ${emailError.message}`,
    };
  }

  revalidatePath(`/[accountSlug]/settings/members/page`);

  return {
    token: data.token,
    message: `Invitation sent to ${email}`,
  };
}
