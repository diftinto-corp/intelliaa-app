"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Assistant } from "@/interfaces/intelliaa";
import { AssistantTypeFilter } from "./TypeFilter";
import { AssistantStatusFilter } from "./StatusFilter";

export interface FilterState {
  search: string;
  type: AssistantTypeFilter;
  status: AssistantStatusFilter;
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  type: "all",
  status: "all",
};

// Status determination helper
// NOTE: This is a simplified implementation. For full error detection,
// wait for INT-32 (Status values alignment) which will add explicit status fields.
function getAssistantStatus(assistant: Assistant): AssistantStatusFilter {
  // Priority 1: Configuring - WhatsApp deployment in progress
  if (assistant.is_deploying_ws) return "configuring";

  // Priority 2: Active - Has at least one active connection
  const hasWhatsAppActive = assistant.activated_whatsApp === true;
  const hasVoiceActive =
    assistant.voice_assistant && assistant.voice_assistant.trim() !== "";

  if (hasWhatsAppActive || hasVoiceActive) {
    return "active";
  }

  // Priority 3: Error - Attempted deployment but failed
  // This is an APPROXIMATION until INT-32 adds explicit error tracking
  // False positives possible for: manually deactivated, never deployed, etc.
  const hasAttemptedWhatsAppDeployment =
    assistant.service_id_rw && assistant.service_id_rw.trim() !== "";

  if (hasAttemptedWhatsAppDeployment && !hasWhatsAppActive && !assistant.is_deploying_ws) {
    return "error"; // APPROXIMATION - May include manually deactivated assistants
  }

  // Priority 4: Disconnected - No deployment attempted or all connections inactive
  return "disconnected";
}

// Type filter matching
function matchesTypeFilter(
  assistant: Assistant,
  type: AssistantTypeFilter
): boolean {
  if (type === "all") return true;

  // Use type_assistant field for filtering
  return assistant.type_assistant === type;
}

// Status filter matching
function matchesStatusFilter(
  assistant: Assistant,
  status: AssistantStatusFilter
): boolean {
  if (status === "all") return true;

  const assistantStatus = getAssistantStatus(assistant);
  return assistantStatus === status;
}

// Search filter matching (case-insensitive, matches name and namespace)
function matchesSearchFilter(assistant: Assistant, search: string): boolean {
  if (!search || search.trim() === "") return true;

  const searchLower = search.toLowerCase();
  const name = (assistant.name || "").toLowerCase();
  const namespace = (assistant.namespace || "").toLowerCase();

  return name.includes(searchLower) || namespace.includes(searchLower);
}

export function useAssistantFilters(assistants: Assistant[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize filters from URL params
  const filters = React.useMemo<FilterState>(
    () => ({
      search: searchParams.get("search") || "",
      type: (searchParams.get("type") as AssistantTypeFilter) || "all",
      status: (searchParams.get("status") as AssistantStatusFilter) || "all",
    }),
    [searchParams]
  );

  // Update URL params when filters change
  const updateFilters = React.useCallback(
    (newFilters: FilterState) => {
      const params = new URLSearchParams();

      if (newFilters.search) params.set("search", newFilters.search);
      if (newFilters.type !== "all") params.set("type", newFilters.type);
      if (newFilters.status !== "all") params.set("status", newFilters.status);

      const queryString = params.toString();
      router.push(`${pathname}${queryString ? `?${queryString}` : ""}`, {
        scroll: false,
      });
    },
    [router, pathname]
  );

  // Filter assistants based on current filters (optimized order: Type > Status > Search)
  const filteredAssistants = React.useMemo(() => {
    return assistants.filter((assistant) => {
      // Type filter (fastest)
      if (!matchesTypeFilter(assistant, filters.type)) return false;

      // Status filter (moderate)
      if (!matchesStatusFilter(assistant, filters.status)) return false;

      // Search filter (slowest)
      if (!matchesSearchFilter(assistant, filters.search)) return false;

      return true;
    });
  }, [assistants, filters.type, filters.status, filters.search]);

  // Helper functions
  const setFilter = React.useCallback(
    (key: keyof FilterState, value: string) => {
      updateFilters({ ...filters, [key]: value });
    },
    [filters, updateFilters]
  );

  const clearFilters = React.useCallback(() => {
    updateFilters(DEFAULT_FILTERS);
  }, [updateFilters]);

  const clearFilter = React.useCallback(
    (key: keyof FilterState) => {
      updateFilters({ ...filters, [key]: DEFAULT_FILTERS[key] });
    },
    [filters, updateFilters]
  );

  const hasActiveFilters = React.useMemo(
    () =>
      filters.search !== "" ||
      filters.type !== "all" ||
      filters.status !== "all",
    [filters]
  );

  return {
    filters,
    setFilters: updateFilters,
    setFilter,
    clearFilters,
    clearFilter,
    hasActiveFilters,
    filteredAssistants,
    filteredCount: filteredAssistants.length,
  };
}
