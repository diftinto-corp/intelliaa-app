/**
 * Assistant Status Types (INT-32)
 * Type definitions for real-time status visualization
 */

/**
 * Assistant status enum matching database assistant_status type
 */
export enum AssistantStatus {
  CONFIGURING = 'configuring',
  ACTIVE = 'active',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

/**
 * Status history item from assistant_status_history table
 */
export interface AssistantStatusHistoryItem {
  id: string;
  assistant_id: string;
  account_id: string;
  status: AssistantStatus;
  error_message: string | null;
  created_at: string;
  metadata: {
    trigger?: string;
    changed_by?: string;
    changed_at?: string;
    source?: string;
    details?: Record<string, any>;
  } | null;
}

/**
 * Input for updating assistant status
 */
export interface UpdateStatusInput {
  accountId: string;
  assistantId: string;
  newStatus: AssistantStatus;
  errorMessage?: string;
  metadata?: UpdateStatusMetadata;
}

/**
 * Metadata for status updates
 */
export interface UpdateStatusMetadata {
  source?: 'manual' | 'automatic' | 'webhook';
  externalServiceId?: string;
  changedBy?: string;
  details?: Record<string, any>;
}

/**
 * Result of status update operation
 */
export interface UpdateStatusResult {
  success: boolean;
  data?: {
    id: string;
    status: AssistantStatus;
    error_message: string | null;
    last_status_change: string;
  };
  error?: {
    code: StatusErrorCode;
    message: string;
    details?: string;
  };
}

/**
 * Error codes for status operations
 */
export enum StatusErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Valid state transitions map
 * Each status maps to an array of valid next statuses
 */
export const VALID_TRANSITIONS: Record<AssistantStatus, AssistantStatus[]> = {
  [AssistantStatus.CONFIGURING]: [
    AssistantStatus.ACTIVE,
    AssistantStatus.ERROR,
    AssistantStatus.DISCONNECTED,
  ],
  [AssistantStatus.ACTIVE]: [
    AssistantStatus.DISCONNECTED,
    AssistantStatus.ERROR,
    AssistantStatus.DISCONNECTED,
    AssistantStatus.CONFIGURING,
  ],
  [AssistantStatus.DISCONNECTED]: [
    AssistantStatus.ACTIVE,
    AssistantStatus.ERROR,
    AssistantStatus.DISCONNECTED,
  ],
  [AssistantStatus.ERROR]: [
    AssistantStatus.CONFIGURING,
    AssistantStatus.DISCONNECTED,
  ],
};

/**
 * Status configuration for UI components
 */
export interface StatusConfig {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
  bgClass: string;
  iconName: 'CheckCircle' | 'Clock' | 'AlertCircle' | 'WifiOff';
  description: string;
}

/**
 * Status configuration map for UI
 */
export const STATUS_CONFIG: Record<AssistantStatus, StatusConfig> = {
  [AssistantStatus.ACTIVE]: {
    label: 'Active',
    color: 'green',
    bgClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    iconName: 'CheckCircle',
    description: 'Assistant is operational and ready',
  },
  [AssistantStatus.CONFIGURING]: {
    label: 'Configuring',
    color: 'yellow',
    bgClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    iconName: 'Clock',
    description: 'Assistant is being deployed',
  },
  [AssistantStatus.ERROR]: {
    label: 'Error',
    color: 'red',
    bgClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    iconName: 'AlertCircle',
    description: 'Assistant encountered an error',
  },
  [AssistantStatus.DISCONNECTED]: {
    label: 'Disconnected',
    color: 'gray',
    bgClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200',
    iconName: 'WifiOff',
    description: 'Assistant is inactive',
  },
};

/**
 * Validates if a status transition is valid
 */
export function isValidTransition(
  currentStatus: AssistantStatus,
  newStatus: AssistantStatus
): boolean {
  // Same status transitions are always valid (idempotent)
  if (currentStatus === newStatus) {
    return true;
  }

  const validNextStatuses = VALID_TRANSITIONS[currentStatus];
  return validNextStatuses.includes(newStatus);
}

/**
 * Gets error message for invalid transition
 */
export function getTransitionErrorMessage(
  currentStatus: AssistantStatus,
  newStatus: AssistantStatus
): string {
  const statusLabels = {
    [AssistantStatus.CONFIGURING]: 'Configuring',
    [AssistantStatus.ACTIVE]: 'Active',
    [AssistantStatus.ERROR]: 'Error',
    [AssistantStatus.DISCONNECTED]: 'Disconnected',
  };

  const currentLabel = statusLabels[currentStatus];
  const newLabel = statusLabels[newStatus];

  // Provide helpful messages for common invalid transitions
  if (currentStatus === AssistantStatus.ERROR && newStatus === AssistantStatus.ACTIVE) {
    return `Cannot change from ${currentLabel} to ${newLabel}. Please resolve the error and reconfigure the assistant first.`;
  }

  if (currentStatus === AssistantStatus.DISCONNECTED && newStatus === AssistantStatus.ERROR) {
    return `Cannot change from ${currentLabel} to ${newLabel}. Reconnect the assistant first.`;
  }

  return `Cannot change status from ${currentLabel} to ${newLabel}. This transition is not allowed.`;
}

/**
 * Result of status history retrieval
 */
export interface StatusHistoryResult {
  success: boolean;
  data?: AssistantStatusHistoryItem[];
  error?: {
    code: StatusErrorCode;
    message: string;
  };
}

/**
 * Result of bulk status update
 */
export interface BulkUpdateResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  failures?: Array<{
    assistantId: string;
    error: string;
  }>;
}
