"use client";

import { useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UnsavedChangesDialogProps {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback when user confirms discarding changes */
  onDiscard: () => void;
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
}

/**
 * UnsavedChangesDialog Component
 *
 * Provides three layers of protection against accidental data loss:
 * 1. Browser navigation guard (beforeunload event)
 * 2. In-app navigation guard (custom AlertDialog)
 * 3. Assistant switch warning
 *
 * @example
 * ```tsx
 * const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
 * const [pendingNavigation, setPendingNavigation] = useState<() => void>();
 *
 * <UnsavedChangesDialog
 *   hasUnsavedChanges={isChangeOptions}
 *   isOpen={showUnsavedDialog}
 *   onClose={() => setShowUnsavedDialog(false)}
 *   onDiscard={() => {
 *     setShowUnsavedDialog(false);
 *     pendingNavigation?.();
 *   }}
 * />
 * ```
 */
export function UnsavedChangesDialog({
  hasUnsavedChanges,
  isOpen,
  onClose,
  onDiscard,
  title = "¿Descartar cambios sin guardar?",
  description = "Tienes cambios sin guardar que se perderán si continúas. ¿Estás seguro de que quieres descartar estos cambios?",
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDiscard}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Descartar cambios
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook for browser navigation guard
 * Prevents accidental page close/reload when there are unsaved changes
 *
 * @param hasUnsavedChanges - Whether there are unsaved changes
 *
 * @example
 * ```tsx
 * useBrowserNavigationGuard(isChangeOptions);
 * ```
 */
export function useBrowserNavigationGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // Modern browsers show a generic message, but we still need to preventDefault
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}

/**
 * Hook for handling assistant switch with unsaved changes
 * Shows dialog before allowing assistant switch
 *
 * @param hasUnsavedChanges - Whether there are unsaved changes
 * @param onConfirmSwitch - Callback when switch is confirmed
 * @returns Object with checkBeforeSwitch function
 *
 * @example
 * ```tsx
 * const { checkBeforeSwitch } = useAssistantSwitchGuard(
 *   isChangeOptions,
 *   () => {
 *     // Actually switch to the new assistant
 *     setSelectedAssistantId(newAssistantId);
 *   }
 * );
 *
 * // In assistant list click handler
 * const handleAssistantClick = (assistantId: string) => {
 *   checkBeforeSwitch(() => {
 *     setSelectedAssistantId(assistantId);
 *   });
 * };
 * ```
 */
export function useAssistantSwitchGuard(
  hasUnsavedChanges: boolean,
  onConfirmSwitch: () => void
) {
  const checkBeforeSwitch = useCallback(
    (switchAction: () => void) => {
      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          "Tienes cambios sin guardar. ¿Deseas descartarlos y cambiar de asistente?"
        );
        if (confirmed) {
          switchAction();
        }
      } else {
        switchAction();
      }
    },
    [hasUnsavedChanges]
  );

  return { checkBeforeSwitch };
}

/**
 * Complete unsaved changes protection hook
 * Combines browser guard and in-app navigation guard
 *
 * @param hasUnsavedChanges - Whether there are unsaved changes
 * @returns Object with showDialog state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   showDialog,
 *   closeDialog,
 *   handleDiscard,
 *   checkBeforeNavigation
 * } = useUnsavedChangesProtection(isChangeOptions);
 *
 * // Use in navigation handler
 * const handleNavigate = () => {
 *   checkBeforeNavigation(() => {
 *     router.push('/other-page');
 *   });
 * };
 *
 * // Render dialog
 * <UnsavedChangesDialog
 *   hasUnsavedChanges={isChangeOptions}
 *   isOpen={showDialog}
 *   onClose={closeDialog}
 *   onDiscard={handleDiscard}
 * />
 * ```
 */
export function useUnsavedChangesProtection(hasUnsavedChanges: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Browser navigation guard
  useBrowserNavigationGuard(hasUnsavedChanges);

  const closeDialog = useCallback(() => {
    setShowDialog(false);
    setPendingAction(null);
  }, []);

  const handleDiscard = useCallback(() => {
    setShowDialog(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const checkBeforeNavigation = useCallback(
    (action: () => void) => {
      if (hasUnsavedChanges) {
        setPendingAction(() => action);
        setShowDialog(true);
      } else {
        action();
      }
    },
    [hasUnsavedChanges]
  );

  return {
    showDialog,
    closeDialog,
    handleDiscard,
    checkBeforeNavigation,
  };
}

// Missing import
import { useState } from "react";
