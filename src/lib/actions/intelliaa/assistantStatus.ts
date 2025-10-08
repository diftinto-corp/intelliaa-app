"use server";

/**
 * Assistant Status Server Actions (INT-32)
 * Handles status updates, transitions, and history
 * Uses Next.js 15 async server actions with Supabase
 */

import { createClient } from "@/lib/supabase/server";
import {
  AssistantStatus,
  UpdateStatusInput,
  UpdateStatusResult,
  StatusErrorCode,
  StatusHistoryResult,
  BulkUpdateResult,
  UpdateStatusMetadata,
  isValidTransition,
  getTransitionErrorMessage,
} from "@/types/assistants";
import { sanitizeErrorMessage } from "@/lib/utils/assistantStatus";

/**
 * Updates assistant status with validation and authorization
 *
 * @param input - Status update parameters
 * @returns Result with success/error information
 */
export async function updateAssistantStatus(
  input: UpdateStatusInput
): Promise<UpdateStatusResult> {
  try {
    const supabase = await createClient();

    // Step 1: Validate input
    const validationError = validateStatusUpdateInput(input);
    if (validationError) {
      return {
        success: false,
        error: {
          code: StatusErrorCode.VALIDATION_ERROR,
          message: validationError,
        },
      };
    }

    // Step 2: Check authorization
    const { data: accounts } = await supabase.rpc(
      "get_accounts_for_current_user"
    );

    const hasAccess = accounts?.some(
      (acc: any) => acc.account_id === input.accountId
    );

    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: StatusErrorCode.UNAUTHORIZED,
          message: "You don't have permission to modify this assistant",
        },
      };
    }

    // Step 3: Get current assistant state
    const { data: assistant, error: fetchError } = await supabase
      .from("assistants")
      .select("id, account_id, status, namespace, name")
      .eq("id", input.assistantId)
      .eq("account_id", input.accountId)
      .single();

    if (fetchError || !assistant) {
      return {
        success: false,
        error: {
          code: StatusErrorCode.NOT_FOUND,
          message: "Assistant not found",
        },
      };
    }

    // Step 4: Validate status transition
    const currentStatus = assistant.status as AssistantStatus;
    if (!isValidTransition(currentStatus, input.newStatus)) {
      return {
        success: false,
        error: {
          code: StatusErrorCode.INVALID_TRANSITION,
          message: getTransitionErrorMessage(currentStatus, input.newStatus),
        },
      };
    }

    // Step 5: Validate error message requirement
    if (input.newStatus === AssistantStatus.ERROR && !input.errorMessage) {
      return {
        success: false,
        error: {
          code: StatusErrorCode.VALIDATION_ERROR,
          message: "Error message is required when setting status to ERROR",
        },
      };
    }

    // Step 6: Execute transaction - update status
    const { data: updated, error: updateError } = await supabase
      .from("assistants")
      .update({
        status: input.newStatus,
        error_message: input.errorMessage
          ? sanitizeErrorMessage(input.errorMessage)
          : null,
        last_status_change: new Date().toISOString(),
      })
      .eq("id", input.assistantId)
      .eq("account_id", input.accountId)
      .select("id, status, error_message, last_status_change")
      .single();

    if (updateError || !updated) {
      console.error("[updateAssistantStatus] Update failed:", updateError);
      return {
        success: false,
        error: {
          code: StatusErrorCode.TRANSACTION_ERROR,
          message: "Failed to update assistant status",
          details: updateError?.message,
        },
      };
    }

    // Note: History record is automatically created by database trigger
    // If application metadata is needed, we can insert it separately

    if (input.metadata) {
      // Enrich history record with application metadata
      await supabase.from("assistant_status_history").insert({
        assistant_id: input.assistantId,
        account_id: input.accountId,
        status: input.newStatus,
        error_message: input.errorMessage
          ? sanitizeErrorMessage(input.errorMessage)
          : null,
        metadata: {
          ...input.metadata,
          enriched_by_app: true,
        },
      });
    }

    console.log(
      `[updateAssistantStatus] Status updated: ${assistant.name} (${assistant.namespace}) -> ${input.newStatus}`
    );

    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status as AssistantStatus,
        error_message: updated.error_message,
        last_status_change: updated.last_status_change,
      },
    };
  } catch (error: any) {
    console.error("[updateAssistantStatus] Unexpected error:", error);
    return {
      success: false,
      error: {
        code: StatusErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
        details: error.message,
      },
    };
  }
}

/**
 * Updates assistant status by namespace (for webhooks)
 *
 * @param namespace - Assistant namespace
 * @param newStatus - New status to set
 * @param errorMessage - Optional error message
 * @param metadata - Optional metadata
 * @returns Update result
 */
export async function updateAssistantStatusByNamespace(
  namespace: string,
  newStatus: AssistantStatus,
  errorMessage?: string,
  metadata?: UpdateStatusMetadata
): Promise<UpdateStatusResult> {
  try {
    const supabase = await createClient();

    // Look up assistant by namespace
    const { data: assistant, error: fetchError } = await supabase
      .from("assistants")
      .select("id, account_id, status, namespace, name")
      .eq("namespace", namespace)
      .single();

    if (fetchError || !assistant) {
      return {
        success: false,
        error: {
          code: StatusErrorCode.NOT_FOUND,
          message: `Assistant not found with namespace: ${namespace}`,
        },
      };
    }

    // Use main update function
    return await updateAssistantStatus({
      accountId: assistant.account_id,
      assistantId: assistant.id,
      newStatus,
      errorMessage,
      metadata,
    });
  } catch (error: any) {
    console.error(
      "[updateAssistantStatusByNamespace] Unexpected error:",
      error
    );
    return {
      success: false,
      error: {
        code: StatusErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
        details: error.message,
      },
    };
  }
}

/**
 * Retrieves status history for an assistant
 *
 * @param accountId - Account ID for authorization
 * @param assistantId - Assistant ID
 * @param limit - Maximum number of records to return (default: 5)
 * @returns Status history result
 */
export async function getAssistantStatusHistory(
  accountId: string,
  assistantId: string,
  limit: number = 5
): Promise<StatusHistoryResult> {
  try {
    const supabase = await createClient();

    // Check authorization
    const { data: accounts } = await supabase.rpc(
      "get_accounts_for_current_user"
    );

    const hasAccess = accounts?.some(
      (acc: any) => acc.account_id === accountId
    );

    if (!hasAccess) {
      return {
        success: false,
        error: {
          code: StatusErrorCode.UNAUTHORIZED,
          message: "You don't have permission to view this assistant's history",
        },
      };
    }

    // Fetch status history
    const { data, error } = await supabase
      .from("assistant_status_history")
      .select("*")
      .eq("assistant_id", assistantId)
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getAssistantStatusHistory] Query failed:", error);
      return {
        success: false,
        error: {
          code: StatusErrorCode.TRANSACTION_ERROR,
          message: "Failed to retrieve status history",
        },
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error: any) {
    console.error("[getAssistantStatusHistory] Unexpected error:", error);
    return {
      success: false,
      error: {
        code: StatusErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
      },
    };
  }
}

/**
 * Bulk update status for multiple assistants (admin operation)
 *
 * @param accountId - Account ID
 * @param assistantIds - Array of assistant IDs
 * @param newStatus - New status to set
 * @param errorMessage - Optional error message
 * @returns Bulk update result
 */
export async function bulkUpdateAssistantStatus(
  accountId: string,
  assistantIds: string[],
  newStatus: AssistantStatus,
  errorMessage?: string
): Promise<BulkUpdateResult> {
  const failures: Array<{ assistantId: string; error: string }> = [];
  let successCount = 0;

  for (const assistantId of assistantIds) {
    const result = await updateAssistantStatus({
      accountId,
      assistantId,
      newStatus,
      errorMessage,
    });

    if (result.success) {
      successCount++;
    } else {
      failures.push({
        assistantId,
        error: result.error?.message || "Unknown error",
      });
    }
  }

  return {
    success: successCount > 0,
    successCount,
    failureCount: failures.length,
    failures: failures.length > 0 ? failures : undefined,
  };
}

/**
 * Validates status update input
 * @returns Error message if invalid, null if valid
 */
function validateStatusUpdateInput(input: UpdateStatusInput): string | null {
  // Validate UUIDs
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(input.accountId)) {
    return "Invalid account ID format";
  }

  if (!uuidRegex.test(input.assistantId)) {
    return "Invalid assistant ID format";
  }

  // Validate status enum
  const validStatuses = Object.values(AssistantStatus);
  if (!validStatuses.includes(input.newStatus)) {
    return `Invalid status. Must be one of: ${validStatuses.join(", ")}`;
  }

  // Validate error message length
  if (input.errorMessage && input.errorMessage.length > 1000) {
    return "Error message must be less than 1000 characters";
  }

  return null;
}
