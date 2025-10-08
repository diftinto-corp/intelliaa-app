import { NextResponse, NextRequest } from "next/server";
import { wsStatusActiveUtil } from "@/lib/actions/intelliaa/assistants";
import { updateAssistantStatusByNamespace } from "@/lib/actions/intelliaa/assistantStatus";
import { AssistantStatus } from "@/types/assistants";

/**
 * Railway Webhook Handler (INT-32 Enhanced)
 * Handles WhatsApp deployment status updates from Railway
 *
 * Payload format:
 * {
 *   status: "SUCCESS" | "FAILED" | "CRASHED",
 *   service: { name: string },
 *   error?: string
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    const { status: statusRw, service, error: deploymentError } = body as {
      status: string;
      service: { name: string };
      error?: string;
    };

    console.log("[Railway Webhook] Received:", {
      status: statusRw,
      namespace: service.name,
      hasError: !!deploymentError,
    });

    const namespace = service.name;

    // Handle SUCCESS status
    if (statusRw === "SUCCESS") {
      // Use legacy function that updates both old and new fields
      const response = await wsStatusActiveUtil(namespace);

      if (response && "error" in response) {
        console.error("[Railway Webhook] Failed to activate:", response.error);
        return NextResponse.json(
          { error: response.error },
          { status: 500 }
        );
      }

      console.log("[Railway Webhook] Successfully activated WhatsApp");
      return NextResponse.json({ success: true, data: response }, { status: 200 });
    }

    // Handle FAILED or CRASHED status (INT-32)
    if (statusRw === "FAILED" || statusRw === "CRASHED") {
      const errorMessage =
        deploymentError ||
        `WhatsApp deployment ${statusRw.toLowerCase()}: ${namespace}`;

      const result = await updateAssistantStatusByNamespace(
        namespace,
        AssistantStatus.ERROR,
        errorMessage,
        {
          source: "webhook",
          details: {
            deployment_status: statusRw,
            timestamp: new Date().toISOString(),
            service: "railway",
          },
        }
      );

      if (!result.success) {
        console.error("[Railway Webhook] Failed to update error status:", result.error);
        return NextResponse.json(
          { error: result.error?.message },
          { status: 500 }
        );
      }

      console.log("[Railway Webhook] Marked assistant as ERROR");
      return NextResponse.json({ success: true, data: result.data }, { status: 200 });
    }

    // Unknown status
    console.warn("[Railway Webhook] Unknown status:", statusRw);
    return NextResponse.json(
      { error: `Unknown status: ${statusRw}` },
      { status: 400 }
    );
  } catch (e: any) {
    console.error("[Railway Webhook] Internal error:", e);
    return NextResponse.json(
      { error: "Internal Server Error", details: e.message },
      { status: 500 }
    );
  }
}
