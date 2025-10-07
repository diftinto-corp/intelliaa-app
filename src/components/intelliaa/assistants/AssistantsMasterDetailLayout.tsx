"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile, useIsMounted } from "@/hooks/use-media-query";
import { useAssistantsList } from "@/hooks/use-assistants-realtime";
import { AssistantsMasterPanel } from "./AssistantsMasterPanel";
import { AssistantsDetailPanel } from "./AssistantsDetailPanel";
import { AssistantsEmptyState } from "./AssistantsEmptyState";
import type {
  AssistantListItem,
  AssistantDetail,
} from "@/lib/actions/intelliaa/assistants-server";

interface AssistantsMasterDetailLayoutProps {
  assistants: AssistantListItem[];
  selectedAssistant: AssistantDetail | null;
  accountSlug: string;
  accountId: string;
}

/**
 * Master-Detail Layout Component
 *
 * Responsibilities:
 * - Manages URL state for selected assistant
 * - Handles responsive behavior (desktop two-column / mobile sheet)
 * - Integrates realtime updates
 * - Orchestrates master panel + detail panel
 *
 * State Management:
 * - URL state: Source of truth for selection
 * - Server state: Initial data from Server Component
 * - Client state: Realtime updates and UI interactions
 */
export function AssistantsMasterDetailLayout({
  assistants: initialAssistants,
  selectedAssistant,
  accountSlug,
  accountId,
}: AssistantsMasterDetailLayoutProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const mounted = useIsMounted();

  // Manage assistants list with realtime updates
  const { assistants } = useAssistantsList(initialAssistants, accountId);

  // Mobile sheet state for detail panel
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Get selected ID from current assistant
  const selectedId = selectedAssistant?.id || null;

  // Handle assistant selection
  const handleSelectAssistant = (assistantId: string) => {
    // Update URL (triggers navigation and server refetch)
    router.push(`/${accountSlug}/assistants/${assistantId}`);

    // On mobile, open sheet
    if (isMobile) {
      setMobileDetailOpen(true);
    }
  };

  // Close mobile detail sheet
  const handleCloseMobileDetail = () => {
    setMobileDetailOpen(false);
    // Navigate back to list view
    router.push(`/${accountSlug}/assistants`);
  };

  // Auto-select first assistant on desktop if none selected
  useEffect(() => {
    if (!mounted) return;

    if (!isMobile && !selectedId && assistants.length > 0) {
      // Auto-select first assistant on desktop
      handleSelectAssistant(assistants[0].id);
    }
  }, [isMobile, selectedId, assistants, mounted]);

  // Show empty state if no assistants
  if (assistants.length === 0) {
    return <AssistantsEmptyState accountSlug={accountSlug} />;
  }

  // Prevent hydration mismatch during SSR
  if (!mounted) {
    return (
      <div className="flex h-full">
        <div className="w-full md:w-[45%] lg:w-[400px] border-r" />
        <div className="hidden md:block md:w-[55%] lg:flex-1" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Master Panel - Always visible */}
      <AssistantsMasterPanel
        assistants={assistants}
        selectedId={selectedId}
        onSelectAssistant={handleSelectAssistant}
      />

      {/* Detail Panel - Desktop: Side-by-side, Mobile: Sheet overlay */}
      {isMobile ? (
        <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-xl p-0"
            onClose={handleCloseMobileDetail}
          >
            <AssistantsDetailPanel assistant={selectedAssistant} />
          </SheetContent>
        </Sheet>
      ) : (
        <AssistantsDetailPanel assistant={selectedAssistant} />
      )}
    </div>
  );
}
