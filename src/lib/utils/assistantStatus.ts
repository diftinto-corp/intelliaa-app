/**
 * Assistant Status Utilities (INT-32)
 * Helper functions for deriving and managing assistant status
 */

import { AssistantStatus } from '@/types/assistants';

/**
 * Assistant data shape for status derivation
 */
interface AssistantData {
  status?: AssistantStatus | string;
  activated_whatsApp?: boolean;
  is_deploying_ws?: boolean;
  error_message?: string | null;
  updated_at?: string;
}

/**
 * Derives assistant status from legacy boolean fields
 * Used during migration period where both systems coexist
 *
 * @param assistant - Assistant data with status or legacy fields
 * @returns Derived AssistantStatus
 */
export function getAssistantStatus(assistant: AssistantData): AssistantStatus {
  // If status field exists and is valid, use it (new system)
  if (assistant.status && isValidStatus(assistant.status)) {
    return assistant.status as AssistantStatus;
  }

  // Otherwise, derive from legacy boolean fields (backward compatibility)
  if (assistant.is_deploying_ws === true) {
    return AssistantStatus.CONFIGURING;
  }

  if (assistant.activated_whatsApp === true) {
    return AssistantStatus.ACTIVE;
  }

  // Check if disconnected (inactive for > 7 days)
  if (
    assistant.activated_whatsApp === false &&
    assistant.is_deploying_ws === false &&
    assistant.updated_at
  ) {
    const updatedAt = new Date(assistant.updated_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (updatedAt < sevenDaysAgo) {
      return AssistantStatus.DISCONNECTED;
    }
  }

  // Default to configuring for new/unknown states
  return AssistantStatus.CONFIGURING;
}

/**
 * Checks if a string is a valid AssistantStatus
 */
export function isValidStatus(status: string): status is AssistantStatus {
  return Object.values(AssistantStatus).includes(status as AssistantStatus);
}

/**
 * Gets human-readable status label
 */
export function getStatusLabel(status: AssistantStatus): string {
  const labels: Record<AssistantStatus, string> = {
    [AssistantStatus.ACTIVE]: 'Active',
    [AssistantStatus.CONFIGURING]: 'Configuring',
    [AssistantStatus.ERROR]: 'Error',
    [AssistantStatus.DISCONNECTED]: 'Disconnected',
  };

  return labels[status];
}

/**
 * Gets status color for UI
 */
export function getStatusColor(status: AssistantStatus): string {
  const colors: Record<AssistantStatus, string> = {
    [AssistantStatus.ACTIVE]: 'green',
    [AssistantStatus.CONFIGURING]: 'yellow',
    [AssistantStatus.ERROR]: 'red',
    [AssistantStatus.DISCONNECTED]: 'gray',
  };

  return colors[status];
}

/**
 * Checks if status indicates an operational assistant
 */
export function isOperational(status: AssistantStatus): boolean {
  return status === AssistantStatus.ACTIVE;
}

/**
 * Checks if status indicates assistant needs attention
 */
export function needsAttention(status: AssistantStatus): boolean {
  return (
    status === AssistantStatus.ERROR ||
    status === AssistantStatus.DISCONNECTED
  );
}

/**
 * Checks if status indicates assistant is in progress
 */
export function isInProgress(status: AssistantStatus): boolean {
  return status === AssistantStatus.CONFIGURING;
}

/**
 * Formats status change timestamp relative to now
 */
export function formatStatusChangeTime(timestamp: string): string {
  const now = new Date();
  const changed = new Date(timestamp);
  const diffMs = now.getTime() - changed.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return changed.toLocaleDateString();
  }
}

/**
 * Sanitizes error message for display
 * Removes sensitive information like API keys, tokens, etc.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return '';

  return (
    message
      // Remove Bearer tokens
      .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]')
      // Remove API keys
      .replace(/api[_-]?key[:\s=]+[A-Za-z0-9-_]+/gi, 'api_key: [REDACTED]')
      // Remove auth tokens
      .replace(/token[:\s=]+[A-Za-z0-9-_]+/gi, 'token: [REDACTED]')
      // Remove file paths
      .replace(/\/[\w/-]+/g, '[PATH]')
      // Truncate to 1000 characters
      .substring(0, 1000)
  );
}

/**
 * Calculates status distribution for summary statistics
 */
export interface StatusDistribution {
  active: number;
  configuring: number;
  error: number;
  disconnected: number;
  total: number;
}

export function calculateStatusDistribution(
  assistants: AssistantData[]
): StatusDistribution {
  const distribution: StatusDistribution = {
    active: 0,
    configuring: 0,
    error: 0,
    disconnected: 0,
    total: assistants.length,
  };

  for (const assistant of assistants) {
    const status = getAssistantStatus(assistant);

    switch (status) {
      case AssistantStatus.ACTIVE:
        distribution.active++;
        break;
      case AssistantStatus.CONFIGURING:
        distribution.configuring++;
        break;
      case AssistantStatus.ERROR:
        distribution.error++;
        break;
      case AssistantStatus.DISCONNECTED:
        distribution.disconnected++;
        break;
    }
  }

  return distribution;
}

/**
 * Filters assistants by status
 */
export function filterByStatus(
  assistants: AssistantData[],
  status: AssistantStatus | 'all'
): AssistantData[] {
  if (status === 'all') {
    return assistants;
  }

  return assistants.filter(
    (assistant) => getAssistantStatus(assistant) === status
  );
}
