import { NextResponse, NextRequest } from "next/server";
import {
  deleteAssistantVoice,
  updateAssistantVoiceVapi,
} from "@/lib/actions/intelliaa/assistantVoice";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Lee y parsea el cuerpo de la solicitud
    const body = await req.json();

    const { id_assistant, voice_assistant_id, accountId } = body as {
      id_assistant: string;
      voice_assistant_id: string;
      accountId: string;
    };

    const response = await deleteAssistantVoice(
      id_assistant,
      voice_assistant_id,
      accountId
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
