import { Resend } from "resend";

const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_KEY);

interface EmailParams {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail({ to, subject, text }: EmailParams) {
  console.log("Enviando correo electrónico:", to, subject, text);
  try {
    const { data, error } = await resend.emails.send({
      from: "Intellia <noreply@app.intelliaa.com>",
      to,
      subject,
      text,
    });

    if (error) {
      console.error("Error al enviar el correo:", error);
      throw new Error("Error al enviar el correo electrónico");
    }

    return data;
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    throw new Error("Error al enviar el correo electrónico");
  }
}
