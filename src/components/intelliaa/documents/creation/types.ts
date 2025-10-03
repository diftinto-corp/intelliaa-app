/**
 * INTEL-004: Document Storage Creation Types
 *
 * TypeScript types for the document storage creation flow
 */

import { ProcessingStep } from "@/lib/actions/intelliaa/documentStorageErrors";

// ============================================================================
// Form Data Types
// ============================================================================

export interface CreateDocumentStorageFormData {
  name: string;
  description: string;
  file: File | null;
}

// ============================================================================
// Processing State Types
// ============================================================================

export type ProcessingState =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'embedding'
  | 'knowledge-base'
  | 'saving'
  | 'success'
  | 'error';

export interface ProcessingProgress {
  state: ProcessingState;
  step: ProcessingStep;
  percentage: number;
  message: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ProcessingError {
  message: string;
  step: ProcessingStep;
  retryable: boolean;
  technicalDetails?: string;
}

// ============================================================================
// Server Response Types
// ============================================================================

export interface CreateStorageSuccessResponse {
  success: true;
  storageId: string;
  pdfDocId: string;
}

export interface CreateStorageErrorResponse {
  success: false;
  error: string;
  step: ProcessingStep;
  retryable: boolean;
  technicalDetails?: string;
}

export type CreateStorageResponse =
  | CreateStorageSuccessResponse
  | CreateStorageErrorResponse;

// ============================================================================
// File Validation Types
// ============================================================================

export interface FileValidationError {
  field: 'file';
  message: string;
  code: 'EMPTY_FILE' | 'INVALID_TYPE' | 'FILE_TOO_LARGE';
}

export interface NameValidationError {
  field: 'name';
  message: string;
}

export type ValidationError = FileValidationError | NameValidationError;

// ============================================================================
// Processing Step Metadata
// ============================================================================

export interface ProcessingStepMetadata {
  id: ProcessingState;
  label: string;
  description: string;
  estimatedTime: string; // e.g., "2-5 segundos"
}

export const PROCESSING_STEPS: Record<ProcessingState, ProcessingStepMetadata> = {
  idle: {
    id: 'idle',
    label: 'Listo',
    description: 'Esperando archivo',
    estimatedTime: '-',
  },
  validating: {
    id: 'validating',
    label: 'Validando',
    description: 'Verificando archivo',
    estimatedTime: '1-2 segundos',
  },
  uploading: {
    id: 'uploading',
    label: 'Subiendo',
    description: 'Cargando archivo PDF',
    estimatedTime: '5-30 segundos',
  },
  embedding: {
    id: 'embedding',
    label: 'Procesando',
    description: 'Generando embeddings',
    estimatedTime: '30-180 segundos',
  },
  'knowledge-base': {
    id: 'knowledge-base',
    label: 'Configurando',
    description: 'Base de conocimientos',
    estimatedTime: '5-10 segundos',
  },
  saving: {
    id: 'saving',
    label: 'Guardando',
    description: 'Almacenando datos',
    estimatedTime: '2-5 segundos',
  },
  success: {
    id: 'success',
    label: 'Completado',
    description: 'Documento creado',
    estimatedTime: '-',
  },
  error: {
    id: 'error',
    label: 'Error',
    description: 'Ha ocurrido un error',
    estimatedTime: '-',
  },
};

// ============================================================================
// Component Props Types
// ============================================================================

export interface FileDropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  error?: string;
  disabled?: boolean;
}

export interface ProcessingProgressProps {
  currentState: ProcessingState;
  error?: ProcessingError;
}

export interface CreateDocumentStorageFormProps {
  accountId: string;
  onSuccess: (storageId: string) => void;
  onCancel: () => void;
}

export interface CreateDocumentStorageModalProps {
  accountId: string;
  onSuccess?: (storageId: string) => void;
  trigger?: React.ReactNode;
  variant?: 'button' | 'empty-state';
}
