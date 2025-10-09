"use client";

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile, useIsMounted } from "@/hooks/use-media-query";
import { useAssistantsList } from "@/hooks/use-assistants-realtime";
import { AssistantsMasterPanel } from "./AssistantsMasterPanel";
import { AssistantsDetailPanel } from "./AssistantsDetailPanel";
import type {
  AssistantListItem,
  AssistantDetail,
} from "@/lib/actions/intelliaa/assistants-server";
import type { AssistantTemplate } from "@/interfaces/intelliaa";

interface AssistantsMasterDetailLayoutProps {
  assistants: AssistantListItem[];
  selectedAssistant: AssistantDetail | null;
  accountId: string;
  templates: AssistantTemplate[];
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
  accountId,
  templates,
}: AssistantsMasterDetailLayoutProps) {
  const isMobile = useIsMobile();
  const mounted = useIsMounted();

  // Manage assistants list with realtime updates
  const { assistants } = useAssistantsList(initialAssistants, accountId);

  // Mobile sheet state for detail panel
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Client-side selected assistant state (fully client-side, no URL navigation)
  const [selectedId, setSelectedId] = useState<string | null>(selectedAssistant?.id || null);
  const [selectedAssistantDetail, setSelectedAssistantDetail] = useState<AssistantDetail | null>(
    selectedAssistant
  );
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Handle assistant selection (fully client-side)
  const handleSelectAssistant = async (assistantId: string) => {
    // Update selection immediately for instant feedback
    setSelectedId(assistantId);
    setIsLoadingDetail(true);

    // Fetch assistant details client-side
    try {
      const { getAssistantById } = await import("@/lib/actions/intelliaa/assistants-server");
      const result = await getAssistantById(assistantId, accountId);

      if (!("error" in result)) {
        setSelectedAssistantDetail(result);
      } else {
        console.error("[AssistantsMasterDetailLayout] Error:", result.error);
      }
    } catch (error) {
      console.error("[AssistantsMasterDetailLayout] Error fetching assistant:", error);
    } finally {
      setIsLoadingDetail(false);
    }

    // On mobile, open sheet
    if (isMobile) {
      setMobileDetailOpen(true);
    }
  };

  // Close mobile detail sheet
  const handleCloseMobileDetail = () => {
    setMobileDetailOpen(false);
    setSelectedId(null);
    setSelectedAssistantDetail(null);
  };

  // Auto-select first assistant on desktop if none selected (DISABLED - causing infinite loop)
  // TODO: Implement auto-select without router.push to avoid infinite re-renders
  // useEffect(() => {
  //   if (!mounted || hasAutoSelected) return;

  //   if (!isMobile && !selectedId && assistants.length > 0) {
  //     // Auto-select first assistant on desktop
  //     router.push(`/${accountSlug}/assistants/${assistants[0].id}`);
  //     setHasAutoSelected(true);
  //   }
  // }, [isMobile, selectedId, assistants, mounted, router, accountSlug, hasAutoSelected]);

  // NOTE (INT-33): Empty state now handled in page.tsx with AssistantsOnboarding component
  // This component only receives assistants when assistants.length > 0
  // No need for empty state check here

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
        templates={templates}
      />

      {/* Detail Panel - Desktop: Side-by-side, Mobile: Sheet overlay */}
      {isMobile ? (
        <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl p-0">
            <AssistantsDetailPanel
              assistant={selectedAssistantDetail}
              isLoading={isLoadingDetail}
            />
          </SheetContent>
        </Sheet>
      ) : (
        <AssistantsDetailPanel
          assistant={selectedAssistantDetail}
          isLoading={isLoadingDetail}
        />
      )}
    </div>
  );
}
