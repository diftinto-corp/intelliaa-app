import { EmailTemplateInvitation } from "@/components/email/EmailTemplateInvitation";
import { NextRequest } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { organitationName, urlInvitation, email } = body as {
    organitationName: string;
    urlInvitation: string;
    email: string;
  };

  try {
    const { data, error } = await resend.emails.send({
      from: "Intelliaa <noreplay@app.intelliaa.com>",
      to: [email],
      subject: "Hola te han invitado a unirte a Intelliaa",
      react: EmailTemplateInvitation({
        invitedByEmail: email,
        organitationName: organitationName,
        urlInvitation: urlInvitation,
      }),
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
