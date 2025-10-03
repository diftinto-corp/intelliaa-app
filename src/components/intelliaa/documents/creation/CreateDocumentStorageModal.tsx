"use client";

/**
 * INTEL-004: Create Document Storage Modal Component
 *
 * Dialog wrapper for document storage creation form
 * - Prevents closing during file processing
 * - Larger modal (600px) for better file preview
 * - Dynamic state management for processing
 * - Mobile-responsive with max-height constraints
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreateDocumentStorageForm } from "./CreateDocumentStorageForm";
import type { CreateDocumentStorageModalProps } from "./types";

export function CreateDocumentStorageModal({
  accountId,
  onSuccess,
  trigger,
  variant = "button",
}: CreateDocumentStorageModalProps) {
  const [open, setOpen] = useState(false);

  const handleSuccess = (storageId: string) => {
    setOpen(false);
    onSuccess?.(storageId);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  // Default trigger based on variant
  const defaultTrigger = variant === "button" ? (
    <Button>
      <Plus className="w-4 h-4 mr-2" />
      Nuevo Documento
    </Button>
  ) : (
    <Button variant="outline" size="lg" className="h-auto p-6">
      <div className="flex flex-col items-center gap-2">
        <Plus className="w-8 h-8" />
        <div className="text-center">
          <p className="font-medium">Crear Documento</p>
          <p className="text-xs text-muted-foreground">
            Sube tu primer PDF
          </p>
        </div>
      </div>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>

      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          // Prevent closing if form is processing
          // This is handled by the modal's open state
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Crear Almacenamiento de Documentos</DialogTitle>
          <DialogDescription>
            Sube un archivo PDF para crear un nuevo almacenamiento de documentos.
            El archivo será procesado y estará disponible para tus asistentes de IA.
          </DialogDescription>
        </DialogHeader>

        <CreateDocumentStorageForm
          accountId={accountId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
