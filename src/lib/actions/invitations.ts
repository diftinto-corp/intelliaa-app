"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";
import { redirect } from "next/navigation";
import fullInvitationUrl from "@/lib/full-invitation-url";

export async function createInvitation(
  prevState: any,
  formData: FormData
): Promise<{ token?: string; message: string }> {
  "use server";

  const invitationType = formData.get("invitationType") as string;
  const accountId = formData.get("accountId") as string;
  const accountRole = formData.get("accountRole") as string;
  const email = formData.get("email") as string;
  const organitationName = formData.get("accountName") as string;

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

  const urlInvitation = fullInvitationUrl(data.token as string);

  // Construir la URL completa
  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const apiUrl = `${baseUrl}/api/send-mail-invitation`;

  // Fetch para enviar el correo
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organitationName,
        urlInvitation,
        email,
      }),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      return {
        message: `Failed to send invitation email: ${errorMessage}`,
      };
    }

    revalidatePath(`/[accountSlug]/settings/members/page`);

    return {
      token: data.token,
      message: `Invitation sent to ${email}`,
    };
  } catch (err: any) {
    return {
      message: `Error sending invitation email: ${err.message || err}`,
    };
  }
}

export async function deleteInvitation(prevState: any, formData: FormData) {
  "use server";

  const invitationId = formData.get("invitationId") as string;
  const returnPath = formData.get("returnPath") as string;

  const supabase = createClient();

  const { error } = await supabase.rpc("delete_invitation", {
    invitation_id: invitationId,
  });

  if (error) {
    return {
      message: error.message,
    };
  }
  redirect(returnPath);
}

export async function acceptInvitation(prevState: any, formData: FormData) {
  "use server";

  const token = formData.get("token") as string;

  const supabase = createClient();

  const { error, data } = await supabase.rpc("accept_invitation", {
    lookup_invitation_token: token,
  });

  if (error) {
    return {
      message: error.message,
    };
  }
  redirect(`/${data.slug}`);
}
