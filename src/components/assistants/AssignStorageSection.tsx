'use client';

// ============================================================================
// Assign Storage Section Component
// Created: 2025-10-04 (INTEL-008)
// Description: Main container for document storage assignment feature
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { StorageSelectionCombobox } from './StorageSelectionCombobox';
import { AssignedStoragesList } from './AssignedStoragesList';
import { useToast } from '@/components/ui/use-toast';
import {
  assignDocumentStorageToVoiceAssistant,
  unassignDocumentStorageFromVoiceAssistant,
  getAssignedStoragesForAssistant,
  getAvailableStoragesForAssistant,
  type AssignedStorage,
} from '@/lib/actions/intelliaa/documentStorageAssignments';

// ============================================================================
// Types
// ============================================================================

type AvailableStorage = {
  id: string;
  name: string;
  description: string | null;
  namespace: string;
};

type OptimisticAssignment = AssignedStorage & {
  isOptimistic?: boolean;
};

// ============================================================================
// Component Props
// ============================================================================

interface AssignStorageSectionProps {
  assistantId: string;
  accountId: string;
  accountSlug: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function AssignStorageSection({
  assistantId,
  accountId,
  accountSlug,
}: AssignStorageSectionProps) {
  const { toast } = useToast();

  // State
  const [assignedStorages, setAssignedStorages] = useState<OptimisticAssignment[]>([]);
  const [availableStorages, setAvailableStorages] = useState<AvailableStorage[]>([]);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(true);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);

  // ========================================================================
  // Data Fetching
  // ========================================================================

  const loadAssignedStorages = useCallback(async () => {
    setIsLoadingAssigned(true);
    const result = await getAssignedStoragesForAssistant(assistantId);

    if (result.success && result.data) {
      setAssignedStorages(result.data);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudieron cargar los almacenamientos asignados',
        variant: 'destructive',
      });
    }
    setIsLoadingAssigned(false);
  }, [assistantId, toast]);

  const loadAvailableStorages = useCallback(async () => {
    setIsLoadingAvailable(true);
    const result = await getAvailableStoragesForAssistant(assistantId, accountId);

    if (result.success && result.data) {
      setAvailableStorages(result.data);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudieron cargar los almacenamientos disponibles',
        variant: 'destructive',
      });
    }
    setIsLoadingAvailable(false);
  }, [assistantId, accountId, toast]);

  // Initial load
  useEffect(() => {
    loadAssignedStorages();
    loadAvailableStorages();
  }, [loadAssignedStorages, loadAvailableStorages]);

  // ========================================================================
  // Assignment Logic with Optimistic Updates
  // ========================================================================

  const handleAssign = async (storageId: string) => {
    const storageToAssign = availableStorages.find((s) => s.id === storageId);
    if (!storageToAssign) return;

    setIsAssigning(true);

    // Optimistic update: Add to assigned list immediately
    const optimisticAssignment: OptimisticAssignment = {
      id: `temp-${Date.now()}`, // Temporary ID
      created_at: new Date().toISOString(),
      storage: {
        id: storageToAssign.id,
        name: storageToAssign.name,
        description: storageToAssign.description,
        namespace: storageToAssign.namespace,
      },
      isOptimistic: true, // Mark as optimistic
    };

    setAssignedStorages((prev) => [optimisticAssignment, ...prev]);
    setAvailableStorages((prev) => prev.filter((s) => s.id !== storageId));

    // Perform actual assignment
    const result = await assignDocumentStorageToVoiceAssistant(assistantId, storageId);

    if (result.success) {
      // Replace optimistic with real data
      setAssignedStorages((prev) =>
        prev.map((assignment) =>
          assignment.id === optimisticAssignment.id && result.data
            ? {
                id: result.data.id,
                created_at: result.data.created_at,
                storage: assignment.storage,
                isOptimistic: false,
              }
            : assignment
        )
      );

      toast({
        title: 'Éxito',
        description: result.message,
      });
    } else {
      // Rollback optimistic update on error
      setAssignedStorages((prev) =>
        prev.filter((a) => a.id !== optimisticAssignment.id)
      );
      setAvailableStorages((prev) => [...prev, storageToAssign]);

      toast({
        title: 'Error al asignar',
        description: result.message,
        variant: 'destructive',
      });
    }

    setIsAssigning(false);
  };

  // ========================================================================
  // Unassignment Logic
  // ========================================================================

  const handleUnassign = async (assignmentId: string) => {
    const assignmentToRemove = assignedStorages.find((a) => a.id === assignmentId);
    if (!assignmentToRemove) return;

    // Remove from assigned list (optimistic)
    setAssignedStorages((prev) => prev.filter((a) => a.id !== assignmentId));

    // Add back to available list
    setAvailableStorages((prev) => [
      ...prev,
      {
        id: assignmentToRemove.storage.id,
        name: assignmentToRemove.storage.name,
        description: assignmentToRemove.storage.description,
        namespace: assignmentToRemove.storage.namespace,
      },
    ]);

    // Perform actual unassignment
    const result = await unassignDocumentStorageFromVoiceAssistant(assignmentId);

    if (result.success) {
      toast({
        title: 'Éxito',
        description: result.message,
      });
    } else {
      // Rollback on error
      setAssignedStorages((prev) => [assignmentToRemove, ...prev]);
      setAvailableStorages((prev) =>
        prev.filter((s) => s.id !== assignmentToRemove.storage.id)
      );

      toast({
        title: 'Error al desasignar',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Almacenamientos de Documentos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Asigna almacenamientos de documentos para que el asistente pueda responder preguntas
          usando la información almacenada.
        </p>
      </div>

      {/* Storage Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Asignar almacenamiento</label>
        <StorageSelectionCombobox
          availableStorages={availableStorages}
          onSelect={handleAssign}
          disabled={isAssigning || isLoadingAvailable}
          isLoading={isLoadingAvailable}
        />
        {isAssigning && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Asignando almacenamiento...</span>
          </div>
        )}
      </div>

      {/* Assigned Storages List */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Almacenamientos asignados</label>
        <AssignedStoragesList
          assignments={assignedStorages}
          onUnassign={handleUnassign}
          isLoading={isLoadingAssigned}
        />
      </div>
    </div>
  );
}
