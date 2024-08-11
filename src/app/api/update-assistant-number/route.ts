import { NextResponse, NextRequest } from "next/server";
import { updateNumerAssistant } from "@/lib/actions/intelliaa/assistantVoice";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    console.log("Request body:", body);

    const {
      id_assistant,
      vapi_id_assistant,
      name_assistant,
      id_number_vapi,
      account_id,
    } = body as {
      id_assistant: string;
      vapi_id_assistant: string;
      name_assistant: string;
      id_number_vapi: string;
      account_id: string;
    };

    const response = await updateNumerAssistant(
      id_assistant,
      vapi_id_assistant,
      name_assistant,
      id_number_vapi,
      account_id
    );

    console.log("API response:", response);

    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    console.error("Internal Server Error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
