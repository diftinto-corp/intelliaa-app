import { NextResponse, NextRequest } from "next/server";
import { updateAssistantVoiceVapi } from "@/lib/actions/intelliaa/assistantVoice";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Lee y parsea el cuerpo de la solicitud
    const body = await req.json();

    const {
      id_assistant,
      prompt,
      welcomeMessage,
      temperature,
      maxTokens,
      voiceId,
      recordCall,
      backgroundOffice,
      detectEmotion,
      id_assistant_vapi,
      fileIds,
    } = body as {
      id_assistant: string;
      prompt: string;
      welcomeMessage: string;
      temperature: number;
      maxTokens: number;
      voiceId: string;
      recordCall: boolean;
      backgroundOffice: boolean;
      detectEmotion: boolean;
      id_assistant_vapi: string;
      fileIds: string[];
    };

    const response = await updateAssistantVoiceVapi(
      id_assistant,
      prompt,
      welcomeMessage,
      temperature,
      maxTokens,
      voiceId,
      recordCall,
      backgroundOffice,
      detectEmotion,
      id_assistant_vapi,
      fileIds
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
