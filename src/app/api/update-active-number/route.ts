import { NextResponse, NextRequest } from "next/server";
import { updateNumberActive } from "@/lib/actions/intelliaa/assistantVoice";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    console.log("Request body:", body);

    const { id_number_vapi, number_transfer, voice_assistant_id } = body as {
      id_number_vapi: string;
      number_transfer: string;
      voice_assistant_id: string;
    };

    const response = await updateNumberActive(
      id_number_vapi,
      number_transfer,
      voice_assistant_id
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
