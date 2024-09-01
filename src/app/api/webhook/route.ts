import { NextRequest, NextResponse } from "next/server";
import { VapiPayload, VapiWebhookEnum } from "@/types/vapi.types";
import { assistantRequestHandler } from "@/lib/actions/intelliaa/vapi/assistantRequest";
import { endOfCallReportHandler } from "@/lib/actions/intelliaa/vapi/endOfCallReport";
import { speechUpdateHandler } from "@/lib/actions/intelliaa/vapi/speechUpdateHandler";
import { statusUpdateHandler } from "@/lib/actions/intelliaa/vapi/statusUpdate";
import { transcriptHandler } from "@/lib/actions/intelliaa/vapi/transcript";
import { HangEventHandler } from "@/lib/actions/intelliaa/vapi/hang";

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  console.log(searchParams);
  // const conversationUuid = searchParams.get("conversation_uuid");

  // if (conversationUuid) {
  //   // This way we can fetch some data from database and use it in the handlers.
  //   // Here you can fetch some context which will be shared across all the webhook events for this conversation.
  //   console.log("conversationUuid", conversationUuid);
  // }

  // try {
  //   const payload: VapiPayload = await req.json();
  //   console.log("type", payload.type, payload);

  //   let result;

  //   switch (payload.type) {
  //     case VapiWebhookEnum.STATUS_UPDATE:
  //       result = await statusUpdateHandler(payload);
  //       break;
  //     case VapiWebhookEnum.ASSISTANT_REQUEST:
  //       result = await assistantRequestHandler(payload);
  //       break;
  //     case VapiWebhookEnum.END_OF_CALL_REPORT:
  //       result = await endOfCallReportHandler(payload);
  //       break;
  //     case VapiWebhookEnum.SPEECH_UPDATE:
  //       result = await speechUpdateHandler(payload);
  //       break;
  //     case VapiWebhookEnum.TRANSCRIPT:
  //       result = await transcriptHandler(payload);
  //       break;
  //     case VapiWebhookEnum.HANG:
  //       result = await HangEventHandler(payload);
  //       break;
  //     default:
  //       throw new Error(`Unhandled message type`);
  //   }

  //   if (result === undefined) {
  //     return NextResponse.json(
  //       { message: "Handler returned undefined" },
  //       { status: 500 }
  //     );
  //   }

  //   return NextResponse.json(result, { status: 201 });
  // } catch (error: unknown) {
  //   console.error("Error in webhook handler:", error);
  //   if (error instanceof Error) {
  //     return NextResponse.json({ message: error.message }, { status: 500 });
  //   } else {
  //     return NextResponse.json(
  //       { message: "An unknown error occurred" },
  //       { status: 500 }
  //     );
  //   }
  // }
}
