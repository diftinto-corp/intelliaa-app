"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssistantTypeFilter } from "./TypeFilter";
import { AssistantStatusFilter } from "./StatusFilter";

interface FilterState {
  search: string;
  type: AssistantTypeFilter;
  status: AssistantStatusFilter;
}

interface FilterChipsProps {
  filters: FilterState;
  onRemoveFilter: (filterKey: keyof FilterState) => void;
}

export function FilterChips({ filters, onRemoveFilter }: FilterChipsProps) {
  const activeFilters = React.useMemo(() => {
    const chips: Array<{
      key: keyof FilterState;
      label: string;
      value: string;
    }> = [];

    if (filters.search) {
      chips.push({
        key: "search",
        label: "Search",
        value: filters.search,
      });
    }

    if (filters.type !== "all") {
      chips.push({
        key: "type",
        label: "Type",
        value: filters.type.charAt(0).toUpperCase() + filters.type.slice(1),
      });
    }

    if (filters.status !== "all") {
      chips.push({
        key: "status",
        label: "Status",
        value: filters.status.charAt(0).toUpperCase() + filters.status.slice(1),
      });
    }

    return chips;
  }, [filters]);

  if (activeFilters.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-2 mb-4"
      role="region"
      aria-label="Active filters"
    >
      {activeFilters.map((filter) => (
        <Badge
          key={filter.key}
          variant="secondary"
          className="pl-3 pr-1 py-1.5 gap-1"
        >
          <span className="text-xs">
            <span className="font-semibold">{filter.label}:</span>{" "}
            {filter.value}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => onRemoveFilter(filter.key)}
            aria-label={`Remove ${filter.label} filter`}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
    </div>
  );
}
