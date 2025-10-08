"use client";

/**
 * StatusBadge Component (INT-32)
 * Displays color-coded status badge with icon and optional tooltip
 */

import * as React from "react";
import { CheckCircle, Clock, AlertCircle, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AssistantStatus, STATUS_CONFIG } from "@/types/assistants";
import { formatStatusChangeTime } from "@/lib/utils/assistantStatus";

export interface StatusBadgeProps {
  /**
   * Current status of the assistant
   */
  status: AssistantStatus;

  /**
   * Error message to display in tooltip (only for error status)
   */
  errorMessage?: string | null;

  /**
   * Timestamp of when the error occurred
   */
  errorTimestamp?: string;

  /**
   * Whether to show pulse animation (for status changes)
   */
  showAnimation?: boolean;

  /**
   * Click handler (for filtering)
   */
  onClick?: () => void;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Size variant
   */
  size?: "sm" | "default" | "lg";
}

// Icon mapping
const ICON_MAP = {
  CheckCircle,
  Clock,
  AlertCircle,
  WifiOff,
};

export function StatusBadge({
  status,
  errorMessage,
  errorTimestamp,
  showAnimation = false,
  onClick,
  className,
  size = "default",
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = ICON_MAP[config.iconName];

  // Size classes
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    default: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizeClasses = {
    sm: "h-3 w-3",
    default: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  // Badge content
  const badgeContent = (
    <Badge
      className={cn(
        config.bgClass,
        sizeClasses[size],
        "flex items-center gap-1.5 transition-all duration-200",
        showAnimation && "animate-pulse-once",
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Icon
        className={cn(
          iconSizeClasses[size],
          status === AssistantStatus.CONFIGURING && "animate-spin-slow"
        )}
        aria-hidden="true"
      />
      <span className="font-medium">{config.label}</span>
    </Badge>
  );

  // If error status with message, wrap in tooltip
  if (status === AssistantStatus.ERROR && errorMessage) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="space-y-1">
              <p className="font-semibold text-sm">Error Details:</p>
              <p className="text-sm">{errorMessage}</p>
              {errorTimestamp && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatStatusChangeTime(errorTimestamp)}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // For other statuses, show simple tooltip with description
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
