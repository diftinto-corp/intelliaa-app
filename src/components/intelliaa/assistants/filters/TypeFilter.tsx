"use client";

import * as React from "react";
import { Phone, MessageCircle, Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AssistantTypeFilter = "all" | "voice" | "whatsapp" | "web";

interface TypeFilterProps {
  value: AssistantTypeFilter;
  onChange: (value: AssistantTypeFilter) => void;
}

const TYPE_OPTIONS = [
  { value: "all" as const, label: "All Types", icon: null },
  { value: "voice" as const, label: "Voice", icon: Phone },
  { value: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
  { value: "web" as const, label: "Web", icon: Globe },
];

export function TypeFilter({ value, onChange }: TypeFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Filter by assistant type">
        <SelectValue placeholder="Type" />
      </SelectTrigger>
      <SelectContent>
        {TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.icon && (
                <option.icon className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
