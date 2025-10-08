"use client";

/**
 * StatusSummary Component (INT-32)
 * Displays aggregate status statistics with click-to-filter functionality
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { AssistantStatus } from "@/types/assistants";
import {
  calculateStatusDistribution,
  type StatusDistribution,
} from "@/lib/utils/assistantStatus";

export interface StatusSummaryProps {
  /**
   * List of assistants to calculate statistics from
   */
  assistants: Array<{
    status?: AssistantStatus | string;
    activated_whatsApp?: boolean;
    is_deploying_ws?: boolean;
  }>;

  /**
   * Callback when a status is clicked (for filtering)
   */
  onStatusClick?: (status: AssistantStatus) => void;

  /**
   * Currently active filter status
   */
  currentFilter?: AssistantStatus;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface StatusItemProps {
  label: string;
  count: number;
  color: string;
  isActive?: boolean;
  onClick?: () => void;
}

function StatusItem({
  label,
  count,
  color,
  isActive = false,
  onClick,
}: StatusItemProps) {
  const colorClasses = {
    green: "text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300",
    yellow: "text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300",
    red: "text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
    gray: "text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200",
        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        colorClasses[color as keyof typeof colorClasses],
        isActive && "bg-accent font-semibold ring-2 ring-primary"
      )}
      aria-label={`Filter by ${label} status (${count} assistants)`}
      aria-pressed={isActive}
    >
      <span className={cn("font-medium", isActive && "font-bold")}>
        {count}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}

export function StatusSummary({
  assistants,
  onStatusClick,
  currentFilter,
  className,
}: StatusSummaryProps) {
  // Calculate distribution
  const distribution: StatusDistribution = React.useMemo(
    () => calculateStatusDistribution(assistants),
    [assistants]
  );

  // Don't show if no assistants
  if (distribution.total === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm",
        className
      )}
      role="group"
      aria-label="Assistant status summary"
    >
      {/* Active */}
      {distribution.active > 0 && (
        <StatusItem
          label="Active"
          count={distribution.active}
          color="green"
          isActive={currentFilter === AssistantStatus.ACTIVE}
          onClick={() => onStatusClick?.(AssistantStatus.ACTIVE)}
        />
      )}

      {/* Separator */}
      {distribution.active > 0 &&
        (distribution.configuring > 0 || distribution.error > 0 || distribution.disconnected > 0) && (
          <span className="text-muted-foreground" aria-hidden="true">
            •
          </span>
        )}

      {/* Configuring */}
      {distribution.configuring > 0 && (
        <StatusItem
          label="Configuring"
          count={distribution.configuring}
          color="yellow"
          isActive={currentFilter === AssistantStatus.CONFIGURING}
          onClick={() => onStatusClick?.(AssistantStatus.CONFIGURING)}
        />
      )}

      {/* Separator */}
      {distribution.configuring > 0 &&
        (distribution.error > 0 || distribution.disconnected > 0) && (
          <span className="text-muted-foreground" aria-hidden="true">
            •
          </span>
        )}

      {/* Error */}
      {distribution.error > 0 && (
        <StatusItem
          label="Errors"
          count={distribution.error}
          color="red"
          isActive={currentFilter === AssistantStatus.ERROR}
          onClick={() => onStatusClick?.(AssistantStatus.ERROR)}
        />
      )}

      {/* Separator */}
      {distribution.error > 0 && distribution.disconnected > 0 && (
        <span className="text-muted-foreground" aria-hidden="true">
          •
        </span>
      )}

      {/* Disconnected */}
      {distribution.disconnected > 0 && (
        <StatusItem
          label="Disconnected"
          count={distribution.disconnected}
          color="gray"
          isActive={currentFilter === AssistantStatus.DISCONNECTED}
          onClick={() => onStatusClick?.(AssistantStatus.DISCONNECTED)}
        />
      )}
    </div>
  );
}
