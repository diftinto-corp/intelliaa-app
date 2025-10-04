'use client';

// ============================================================================
// Assigned Storages List Component
// Created: 2025-10-04 (INTEL-008)
// Description: Displays list of assigned document storages with unassign action
// ============================================================================

import { Loader2, FileText } from 'lucide-react';
import { AssignedStorageCard } from './AssignedStorageCard';
import type { AssignedStorage } from '@/lib/actions/intelliaa/documentStorageAssignments';

// ============================================================================
// Types
// ============================================================================

type OptimisticAssignment = AssignedStorage & {
  isOptimistic?: boolean;
};

interface AssignedStoragesListProps {
  assignments: OptimisticAssignment[];
  onUnassign: (assignmentId: string) => void;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AssignedStoragesList({
  assignments,
  onUnassign,
  isLoading = false,
}: AssignedStoragesListProps) {
  // ========================================================================
  // Loading State
  // ========================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 border border-dashed rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Cargando almacenamientos asignados...
          </p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // Empty State
  // ========================================================================

  if (assignments.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 border border-dashed rounded-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Sin almacenamientos asignados</p>
            <p className="text-sm text-muted-foreground mt-1">
              Selecciona un almacenamiento arriba para comenzar
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // List of Assignments
  // ========================================================================

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {assignments.map((assignment) => (
        <AssignedStorageCard
          key={assignment.id}
          assignment={assignment}
          onUnassign={onUnassign}
          isOptimistic={assignment.isOptimistic}
        />
      ))}
    </div>
  );
}
