"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AssistantStatusFilter =
  | "all"
  | "active"
  | "configuring"
  | "error"
  | "disconnected";

interface StatusFilterProps {
  value: AssistantStatusFilter;
  onChange: (value: AssistantStatusFilter) => void;
}

const STATUS_OPTIONS = [
  { value: "all" as const, label: "All Statuses", color: null },
  {
    value: "active" as const,
    label: "Active",
    color: "bg-green-500",
  },
  {
    value: "configuring" as const,
    label: "Configuring",
    color: "bg-yellow-500",
  },
  {
    value: "error" as const,
    label: "Error",
    color: "bg-red-500",
  },
  {
    value: "disconnected" as const,
    label: "Disconnected",
    color: "bg-gray-500",
  },
];

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Filter by assistant status">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.color && (
                <div
                  className={cn("h-2 w-2 rounded-full", option.color)}
                  aria-hidden="true"
                />
              )}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
