'use client';

/**
 * INTEL-007: Delete Document Storage Dialog Component
 *
 * AlertDialog-based confirmation for deleting document storage with:
 * - Assignment validation (shows assigned assistants with badges)
 * - Multi-state management (idle → validating → deleting → success/error/blocked)
 * - Loading states with spinners
 * - Toast notifications for feedback
 * - Graceful error handling
 * - WCAG 2.1 AA compliant
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { DeleteDocumentStorageResponse } from '@/lib/actions/intelliaa/documents';

/**
 * UI States
 */
type DialogState =
  | 'idle'                // Initial state, button enabled
  | 'validating'          // Checking assignments
  | 'blocked'             // Assigned to assistants
  | 'idle_ready'          // Validation passed, ready to delete
  | 'deleting'            // Deletion in progress
  | 'success'             // Deleted successfully
  | 'error';              // Error occurred

interface AssignedAssistant {
  assistant_id: string;
  assistant_name: string;
}

interface DeleteDocumentStorageDialogProps {
  documentStorageId: string;
  storageName: string;
  pdfCount: number;
  qaCount: number;
  onDelete: () => Promise<DeleteDocumentStorageResponse>;
  redirectPath: string;
}

export function DeleteDocumentStorageDialog({
  documentStorageId,
  storageName,
  pdfCount,
  qaCount,
  onDelete,
  redirectPath,
}: DeleteDocumentStorageDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = useState<DialogState>('idle');
  const [open, setOpen] = useState(false);
  const [assignedAssistants, setAssignedAssistants] = useState<AssignedAssistant[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const totalFiles = pdfCount + qaCount;

  /**
   * Handle dialog open - trigger validation
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && state === 'idle') {
      // Reset state when opening
      setState('idle');
      setAssignedAssistants([]);
      setErrorMessage('');
    }
    setOpen(newOpen);
  };

  /**
   * Handle delete action
   */
  const handleDelete = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault(); // CRITICAL: Prevent AlertDialog auto-close
    }

    setState('deleting');

    try {
      const result = await onDelete();

      if (!result.success) {
        // Handle errors
        if (result.error?.code === 'ASSIGNED_TO_ASSISTANTS') {
          setAssignedAssistants(result.error.assignedAssistants || []);
          setState('blocked');
          return;
        }

        // Other errors
        setErrorMessage(result.error?.message || 'Error desconocido');
        setState('error');
        return;
      }

      // Success
      setState('success');

      // Show toast with warnings if any
      if (result.warnings && result.warnings.length > 0) {
        toast({
          title: 'Almacenamiento eliminado con advertencias',
          description: (
            <ul className="list-disc list-inside space-y-1 text-sm">
              {result.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ),
          variant: 'default',
        });
      } else {
        toast({
          title: 'Almacenamiento eliminado',
          description: `"${storageName}" ha sido eliminado correctamente.`,
        });
      }

      // Close dialog and redirect
      setOpen(false);
      router.push(redirectPath);
      router.refresh();

    } catch (error) {
      console.error('[DeleteDocumentStorageDialog] Unexpected error:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Error inesperado al eliminar'
      );
      setState('error');
    }
  };

  /**
   * Get dialog content based on state
   */
  const getDialogContent = () => {
    // Blocked state - show assigned assistants
    if (state === 'blocked') {
      return (
        <>
          <AlertDialogDescription className="sr-only">
            Este almacenamiento no se puede eliminar porque está asignado a asistentes
          </AlertDialogDescription>
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No se puede eliminar</AlertTitle>
            <AlertDescription>
              <p className="mb-3">
                Este almacenamiento está asignado a los siguientes asistentes:
              </p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {assignedAssistants.map((assistant) => (
                  <Badge
                    key={assistant.assistant_id}
                    variant="secondary"
                    className="text-xs"
                  >
                    {assistant.assistant_name}
                  </Badge>
                ))}
              </div>
              <p className="text-xs mt-3 text-muted-foreground">
                Elimine las asignaciones antes de continuar.
              </p>
            </AlertDescription>
          </Alert>
        </>
      );
    }

    // Error state
    if (state === 'error') {
      return (
        <>
          <AlertDialogDescription className="sr-only">
            Ocurrió un error al intentar eliminar el almacenamiento
          </AlertDialogDescription>
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error al eliminar</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </>
      );
    }

    // Deleting state
    if (state === 'deleting') {
      return (
        <AlertDialogDescription asChild>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Eliminando almacenamiento...</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Esto puede tomar unos segundos. Por favor, no cierres esta ventana.
            </p>
          </div>
        </AlertDialogDescription>
      );
    }

    // Default state - show deletion info
    return (
      <AlertDialogDescription asChild>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Estás a punto de eliminar el almacenamiento{' '}
            <span className="font-semibold">"{storageName}"</span>.
          </p>
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <p className="font-medium">Se eliminarán:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>{totalFiles} archivo{totalFiles !== 1 ? 's' : ''} ({pdfCount} PDF, {qaCount} QA)</li>
              <li>Vectores embeddings en Pinecone</li>
              <li>Configuración del Knowledge Base</li>
              <li>Todos los registros asociados</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer.
          </p>
        </div>
      </AlertDialogDescription>
    );
  };

  /**
   * Get action button text based on state
   */
  const getActionButton = () => {
    if (state === 'blocked') {
      return null; // No action button when blocked
    }

    if (state === 'error') {
      return (
        <AlertDialogAction
          onClick={handleDelete}
          className={buttonVariants({ variant: "destructive" })}
        >
          Reintentar
        </AlertDialogAction>
      );
    }

    if (state === 'deleting') {
      return (
        <Button
          variant="destructive"
          disabled
          className="min-w-[100px]"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Eliminando
        </Button>
      );
    }

    return (
      <AlertDialogAction
        onClick={handleDelete}
        className={buttonVariants({ variant: "destructive" })}
      >
        Eliminar
      </AlertDialogAction>
    );
  };

  /**
   * Get cancel button text based on state
   */
  const getCancelButton = () => {
    if (state === 'blocked') {
      return (
        <AlertDialogCancel onClick={() => {
          setOpen(false);
          setState('idle');
        }}>
          Entendido
        </AlertDialogCancel>
      );
    }

    if (state === 'deleting') {
      return null; // Hide cancel during deletion
    }

    return (
      <AlertDialogCancel>
        Cancelar
      </AlertDialogCancel>
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          disabled={state === 'deleting'}
        >
          {state === 'deleting' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Eliminando
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar almacenamiento
            </>
          )}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            ¿Eliminar almacenamiento de documentos?
          </AlertDialogTitle>
          {getDialogContent()}
        </AlertDialogHeader>

        <AlertDialogFooter>
          {getCancelButton()}
          {getActionButton()}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
