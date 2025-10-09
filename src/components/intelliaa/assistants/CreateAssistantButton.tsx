"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import FormAddComponent from "./FormAdd";
import type { AssistantTemplate } from "@/interfaces/intelliaa";

interface CreateAssistantButtonProps {
  templates: AssistantTemplate[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

/**
 * Create Assistant Button Component
 *
 * Reusable button that opens a modal with the FormAdd component
 * for creating new assistants.
 *
 * Used in:
 * - AssistantsMasterPanel (when assistants exist)
 * - Future: Toolbar, Empty states, etc.
 *
 * This is a Client Component because it manages modal state.
 */
export function CreateAssistantButton({
  templates,
  variant = "default",
  size = "default",
  className,
}: CreateAssistantButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowModal(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Crear Asistente
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Asistente</DialogTitle>
          </DialogHeader>

          <FormAddComponent
            dataTemplates={{ templates }}
            setOpenModal={setShowModal}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
