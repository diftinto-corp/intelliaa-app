"use client";

import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AssistantListItem as AssistantListItemType } from "@/lib/actions/intelliaa/assistants-server";
import { cn } from "@/lib/utils";

interface AssistantListItemProps {
  assistant: AssistantListItemType;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Individual assistant list item
 * Memoized to prevent unnecessary re-renders
 */
export const AssistantListItem = memo(function AssistantListItem({
  assistant,
  isSelected,
  onClick,
}: AssistantListItemProps) {
  const {
    name,
    activated_whatsapp,
    is_deploying_ws,
    updated_at,
  } = assistant;

  // Determine assistant type and status
  const isWhatsApp = activated_whatsapp || is_deploying_ws;
  const isActive = activated_whatsapp;
  const isDeploying = is_deploying_ws && !activated_whatsapp;

  // Format timestamp
  const lastUpdated = formatDistanceToNow(new Date(updated_at), {
    addSuffix: true,
  });

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 cursor-pointer transition-all duration-200",
        "hover:bg-accent hover:shadow-md",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isSelected && "bg-accent border-l-4 border-l-primary shadow-sm"
      )}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="bg-primary/10">
            {isWhatsApp ? (
              <MessageSquare className="h-5 w-5 text-primary" />
            ) : (
              <Bot className="h-5 w-5 text-primary" />
            )}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Name and type badge */}
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate" title={name}>
              {name}
            </h3>
            <Badge variant={isWhatsApp ? "default" : "secondary"} className="flex-shrink-0">
              {isWhatsApp ? "WhatsApp" : "Voice"}
            </Badge>
          </div>

          {/* Status and timestamp */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {/* Status indicator */}
            {isDeploying ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                <span className="text-xs text-amber-600">Deploying</span>
              </div>
            ) : isActive ? (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-700 dark:text-green-400">Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                <span className="text-xs">Inactive</span>
              </div>
            )}

            {/* Separator */}
            <span className="text-muted-foreground/50">•</span>

            {/* Last updated */}
            <span className="text-xs truncate" title={`Last updated ${lastUpdated}`}>
              {lastUpdated}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
});
