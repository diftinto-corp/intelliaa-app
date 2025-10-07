"use client";

import * as React from "react";
import { SearchInput } from "./SearchInput";
import { TypeFilter } from "./TypeFilter";
import { StatusFilter } from "./StatusFilter";
import { ClearFiltersButton } from "./ClearFiltersButton";
import { FilterState } from "./useAssistantFilters";
import { cn } from "@/lib/utils";

interface AssistantsFilterBarProps {
  onFiltersChange: (filters: FilterState) => void;
  currentFilters: FilterState;
  totalCount: number;
  filteredCount: number;
}

export function AssistantsFilterBar({
  onFiltersChange,
  currentFilters,
  totalCount,
  filteredCount,
}: AssistantsFilterBarProps) {
  const hasActiveFilters = React.useMemo(
    () =>
      currentFilters.search !== "" ||
      currentFilters.type !== "all" ||
      currentFilters.status !== "all",
    [currentFilters]
  );

  return (
    <div
      className={cn(
        "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "border-b border-border pb-4 mb-6"
      )}
      role="search"
      aria-label="Assistant filters"
    >
      {/* Filter Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        {/* Search - Full width on mobile, flex-1 on desktop */}
        <div className="w-full md:flex-1">
          <SearchInput
            value={currentFilters.search}
            onChange={(value) =>
              onFiltersChange({ ...currentFilters, search: value })
            }
          />
        </div>

        {/* Type & Status Filters - Side by side */}
        <div className="flex gap-3 md:gap-4">
          <div className="flex-1 md:w-[200px]">
            <TypeFilter
              value={currentFilters.type}
              onChange={(value) =>
                onFiltersChange({ ...currentFilters, type: value })
              }
            />
          </div>

          <div className="flex-1 md:w-[200px]">
            <StatusFilter
              value={currentFilters.status}
              onChange={(value) =>
                onFiltersChange({ ...currentFilters, status: value })
              }
            />
          </div>
        </div>

        {/* Clear Filters Button - Only show when filters active */}
        {hasActiveFilters && (
          <ClearFiltersButton
            onClick={() =>
              onFiltersChange({ search: "", type: "all", status: "all" })
            }
          />
        )}
      </div>
    </div>
  );
}
