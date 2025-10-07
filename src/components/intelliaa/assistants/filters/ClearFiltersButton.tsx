"use client";

import * as React from "react";
import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClearFiltersButtonProps {
  onClick: () => void;
}

export function ClearFiltersButton({ onClick }: ClearFiltersButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="shrink-0"
      aria-label="Clear all filters"
    >
      <FilterX className="h-4 w-4" />
      <span className="hidden sm:inline">Clear Filters</span>
      <span className="sm:hidden">Clear</span>
    </Button>
  );
}
