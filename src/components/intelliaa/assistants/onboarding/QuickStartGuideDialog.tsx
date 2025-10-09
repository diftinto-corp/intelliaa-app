"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-media-query";
import { CheckCircle2, Sparkles, FileText, Rocket } from "lucide-react";

interface QuickStartGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Quick Start Guide Dialog Component
 *
 * Displays a responsive dialog/sheet with getting started instructions.
 * - Desktop: Dialog (modal)
 * - Mobile: Sheet (drawer from bottom)
 *
 * Content:
 * - 4-step getting started guide
 * - Icons for visual guidance
 * - Spanish content
 *
 * This is a Client Component because it uses useIsMobile hook.
 */
export function QuickStartGuideDialog({
  open,
  onOpenChange,
}: QuickStartGuideDialogProps) {
  const isMobile = useIsMobile();

  const steps = [
    {
      icon: Sparkles,
      title: "Elige tu tipo de asistente",
      description:
        "Selecciona entre asistente de Voz para llamadas telefónicas o WhatsApp para mensajería automatizada.",
    },
    {
      icon: FileText,
      title: "Selecciona una plantilla",
      description:
        "Elige una plantilla pre-configurada que mejor se adapte a tu caso de uso (atención al cliente, ventas, soporte técnico, etc.).",
    },
    {
      icon: CheckCircle2,
      title: "Personaliza tu asistente",
      description:
        "Dale un nombre único a tu asistente. Podrás configurar su comportamiento, voz, y base de conocimiento más adelante.",
    },
    {
      icon: Rocket,
      title: "¡Despliega y comienza!",
      description:
        "Una vez creado, configura los documentos de conocimiento y despliega tu asistente. Para WhatsApp, escanea el código QR.",
    },
  ];

  const content = (
    <>
      <div className="space-y-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} className="flex gap-4">
              {/* Step Number & Icon */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {index + 1}
                  </div>
                </div>
              </div>

              {/* Step Content */}
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Help Text */}
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Consejo:</span> Puedes
          crear múltiples asistentes para diferentes propósitos. Por ejemplo, uno
          para ventas y otro para soporte técnico.
        </p>
      </div>
    </>
  );

  // Mobile: Sheet (drawer)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Guía de Inicio Rápido</SheetTitle>
            <SheetDescription>
              Sigue estos pasos para crear tu primer asistente de IA
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Dialog (modal)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Guía de Inicio Rápido</DialogTitle>
          <DialogDescription>
            Sigue estos pasos para crear tu primer asistente de IA
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
