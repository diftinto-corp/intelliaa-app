import { NextResponse, NextRequest } from "next/server";
import { createAssistantVoiceVapi } from "@/lib/actions/intelliaa/assistantVoice";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Lee y parsea el cuerpo de la solicitud
    const body = await req.json();

    const { account_id, name, type, template_id, prompt, temperature, tokens } =
      body as {
        account_id: string;
        name: string;
        type: string;
        template_id: string;
        prompt: string;
        temperature: number;
        tokens: number;
      };

    const response = await createAssistantVoiceVapi(
      account_id,
      name,
      type,
      template_id,
      prompt,
      temperature,
      tokens
    );

    // Asegurarse de que response es serializable
    if (response && typeof response === "object") {
      return NextResponse.json(response, { status: 200 });
    } else {
      // Transformar response en un objeto serializable si no lo es
      return NextResponse.json({ result: String(response) }, { status: 200 });
    }
  } catch (e) {
    console.error("Internal Server Error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
