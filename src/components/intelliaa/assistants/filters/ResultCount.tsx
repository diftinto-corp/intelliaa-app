"use client";

import * as React from "react";

interface ResultCountProps {
  filteredCount: number;
  totalCount: number;
  isFiltered: boolean;
}

export function ResultCount({
  filteredCount,
  totalCount,
  isFiltered,
}: ResultCountProps) {
  return (
    <div
      className="text-sm text-muted-foreground mb-3"
      role="status"
      aria-live="polite"
    >
      {isFiltered ? (
        <>
          Showing{" "}
          <span className="font-semibold text-foreground">{filteredCount}</span>{" "}
          of <span className="font-semibold text-foreground">{totalCount}</span>{" "}
          {totalCount === 1 ? "assistant" : "assistants"}
        </>
      ) : (
        <>
          <span className="font-semibold text-foreground">{totalCount}</span>{" "}
          {totalCount === 1 ? "assistant" : "assistants"}
        </>
      )}
    </div>
  );
}
