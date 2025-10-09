import { redirect } from "next/navigation";
import {
  getAssistantsForAccount,
  getAssistantById,
} from "@/lib/actions/intelliaa/assistants-server";
import { isError } from "@/lib/utils/serverActions";
import { AssistantsMasterDetailLayout } from "@/components/intelliaa/assistants/AssistantsMasterDetailLayout";

/**
 * Assistants Page - Master-Detail Layout
 *
 * Route Pattern: /[accountSlug]/assistants/[[...assistantId]]
 * - /[accountSlug]/assistants → List view (no selection)
 * - /[accountSlug]/assistants/[id] → List + detail view
 *
 * Next.js 15 Features:
 * - params is Promise<{ ... }> - must await
 * - Server Component (async function)
 * - Server-side data fetching with optimized queries
 */

interface AssistantsPageProps {
  params: Promise<{
    accountSlug: string;
    assistantId?: string[];
  }>;
}

export default async function AssistantsPage({ params }: AssistantsPageProps) {
  // MUST await params in Next.js 15
  const { accountSlug, assistantId } = await params;

  // Extract selected ID from optional catch-all array
  // assistantId is undefined when no assistant is selected
  // assistantId is ['abc123'] when assistant abc123 is selected
  const selectedId = assistantId?.[0];

  // Resolve accountSlug to account_id using Basejump RPC
  const { getAccountIdFromSlug } = await import("@/lib/actions/accounts");
  const accountId = await getAccountIdFromSlug(accountSlug);

  // If account not found, redirect to dashboard
  if (!accountId) {
    redirect("/");
  }

  // Fetch assistants list for master panel (server-side)
  const assistantsResult = await getAssistantsForAccount(accountId, {
    limit: 100, // Fetch more for virtual scrolling
    orderBy: "updated_at",
    orderDirection: "desc",
  });

  // Handle error fetching assistants
  if (isError(assistantsResult)) {
    console.error("[AssistantsPage] Error fetching assistants:", assistantsResult.error);
    // Redirect to dashboard on error (or show error page)
    redirect(`/${accountSlug}`);
  }

  const assistants = assistantsResult;

  // If no assistants exist, the layout will show empty state
  // No need to handle this here

  // Fetch selected assistant details if an ID is provided
  let selectedAssistant = null;
  if (selectedId) {
    const assistantResult = await getAssistantById(selectedId, accountId);

    if (isError(assistantResult)) {
      console.error(
        "[AssistantsPage] Error fetching assistant details:",
        assistantResult.error
      );
      // Invalid assistant ID - redirect to list view
      redirect(`/${accountSlug}/assistants`);
    }

    selectedAssistant = assistantResult;
  }

  // Render master-detail layout with server-fetched data
  return (
    <AssistantsMasterDetailLayout
      assistants={assistants}
      selectedAssistant={selectedAssistant}
      accountSlug={accountSlug}
      accountId={accountId}
    />
  );
}

/**
 * Generate metadata for the page
 * Shows selected assistant name in title if applicable
 */
export async function generateMetadata({ params }: AssistantsPageProps) {
  const { accountSlug, assistantId } = await params;
  const selectedId = assistantId?.[0];

  if (selectedId) {
    // TODO: Fetch assistant name for title
    // For now, use generic title
    return {
      title: `Assistant Details | ${accountSlug}`,
    };
  }

  return {
    title: `Assistants | ${accountSlug}`,
  };
}
