"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyFilterStateProps {
  onClearFilters: () => void;
}

export function EmptyFilterState({ onClearFilters }: EmptyFilterStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No assistants found</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        No assistants match your current filters. Try adjusting your search or
        filter criteria.
      </p>
      <Button variant="outline" onClick={onClearFilters}>
        Clear All Filters
      </Button>
    </div>
  );
}
