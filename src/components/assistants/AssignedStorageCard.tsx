'use client';

// ============================================================================
// Assigned Storage Card Component
// Created: 2025-10-04 (INTEL-008)
// Description: Card displaying individual assigned storage with unassign action
// ============================================================================

import { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { AssignedStorage } from '@/lib/actions/intelliaa/documentStorageAssignments';

// ============================================================================
// Types
// ============================================================================

interface AssignedStorageCardProps {
  assignment: AssignedStorage;
  onUnassign: (assignmentId: string) => void;
  isOptimistic?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AssignedStorageCard({
  assignment,
  onUnassign,
  isOptimistic = false,
}: AssignedStorageCardProps) {
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);

  const handleUnassignConfirm = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent dialog auto-close
    onUnassign(assignment.id);
    setShowUnassignDialog(false);
  };

  return (
    <>
      <div
        className={cn(
          'relative group rounded-lg border bg-card p-4 transition-all hover:shadow-md',
          isOptimistic && 'border-dashed border-primary/50'
        )}
      >
        {/* Optimistic Badge */}
        {isOptimistic && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="text-xs">
              Asignando...
            </Badge>
          </div>
        )}

        {/* Content */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              isOptimistic ? 'bg-primary/10' : 'bg-primary/20'
            )}
          >
            <FileText className={cn('h-5 w-5', isOptimistic ? 'text-primary/50' : 'text-primary')} />
          </div>

          {/* Storage Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{assignment.storage.name}</h4>
            {assignment.storage.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {assignment.storage.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Namespace: <code className="text-xs">{assignment.storage.namespace}</code>
            </p>
          </div>
        </div>

        {/* Unassign Button */}
        {!isOptimistic && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setShowUnassignDialog(true)}
            aria-label={`Desasignar ${assignment.storage.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desasignar almacenamiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el acceso del asistente al almacenamiento{' '}
              <span className="font-medium text-foreground">{assignment.storage.name}</span>. El
              asistente ya no podrá responder preguntas usando estos documentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassignConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desasignar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
