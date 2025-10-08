"use client";

/**
 * StatusHistoryTimeline Component (INT-32)
 * Displays chronological history of status changes for an assistant
 */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Clock, WifiOff, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssistantStatus, STATUS_CONFIG } from "@/types/assistants";
import { formatDistanceToNow } from "date-fns";

interface StatusHistoryItem {
  id: string;
  status: AssistantStatus;
  error_message: string | null;
  created_at: string;
  metadata: {
    source?: "manual" | "automatic" | "webhook";
    changedBy?: string;
    details?: Record<string, any>;
  } | null;
}

export interface StatusHistoryTimelineProps {
  /**
   * Assistant ID to fetch history for
   */
  assistantId: string;

  /**
   * Account ID for authorization
   */
  accountId: string;

  /**
   * Number of history items to show (default: 5)
   */
  limit?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

// Icon mapping
const ICON_MAP = {
  CheckCircle,
  Clock,
  AlertCircle,
  WifiOff,
};

/**
 * Individual timeline item
 */
function TimelineItem({
  item,
  isFirst,
  isLast,
}: {
  item: StatusHistoryItem;
  isFirst: boolean;
  isLast: boolean;
}) {
  const config = STATUS_CONFIG[item.status];
  const Icon = ICON_MAP[config.iconName];

  // Format timestamp
  const timeAgo = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
  });

  // Get source label
  const sourceLabel =
    item.metadata?.source === "manual"
      ? "Manual change"
      : item.metadata?.source === "webhook"
      ? "Webhook"
      : "Automatic";

  return (
    <div className="flex gap-3 relative pb-6 last:pb-0">
      {/* Timeline line */}
      {!isLast && (
        <div
          className="absolute left-4 top-8 w-0.5 h-full bg-border"
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10",
          config.bgClass
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Status and timestamp */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className={cn("font-medium text-sm", config.textClass)}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        {/* Error message */}
        {item.status === AssistantStatus.ERROR && item.error_message && (
          <p className="text-sm text-muted-foreground mb-1 line-clamp-2">
            {item.error_message}
          </p>
        )}

        {/* Source */}
        <p className="text-xs text-muted-foreground">{sourceLabel}</p>

        {/* Changed by (if available) */}
        {item.metadata?.changedBy && (
          <p className="text-xs text-muted-foreground">
            by {item.metadata.changedBy}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for timeline
 */
function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state when no history available
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <History
        className="h-12 w-12 text-muted-foreground/50 mb-3"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">No status history yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Changes will appear here as they occur
      </p>
    </div>
  );
}

export function StatusHistoryTimeline({
  assistantId,
  accountId,
  limit = 5,
  className,
}: StatusHistoryTimelineProps) {
  const [history, setHistory] = React.useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch status history
  React.useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError(null);

      try {
        // Import dynamically to avoid SSR issues
        const { getAssistantStatusHistory } = await import(
          "@/lib/actions/intelliaa/assistantStatus"
        );

        const result = await getAssistantStatusHistory(
          accountId,
          assistantId,
          limit
        );

        if (!result.success) {
          setError(result.error?.message || "Failed to load history");
          setHistory([]);
        } else {
          setHistory(result.data || []);
        }
      } catch (err: any) {
        console.error("[StatusHistoryTimeline] Error:", err);
        setError(err.message || "An unexpected error occurred");
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [assistantId, accountId, limit]);

  return (
    <Card className={cn("p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-medium text-sm">Status History</h3>
      </div>

      {/* Content */}
      <ScrollArea className="h-[300px] pr-4">
        {loading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md">
            <AlertCircle
              className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Failed to load history
              </p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        ) : history.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-0">
            {history.map((item, index) => (
              <TimelineItem
                key={item.id}
                item={item}
                isFirst={index === 0}
                isLast={index === history.length - 1}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
