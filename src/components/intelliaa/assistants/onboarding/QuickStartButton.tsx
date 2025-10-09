"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { QuickStartGuideDialog } from "./QuickStartGuideDialog";

/**
 * Quick Start Button Component
 *
 * Button that opens the Quick Start Guide dialog.
 * Provides users with getting started instructions.
 *
 * This is a Client Component because it manages dialog state.
 */
export function QuickStartButton() {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Lightbulb className="h-5 w-5" />
        Guía de Inicio Rápido
      </Button>

      <QuickStartGuideDialog open={showDialog} onOpenChange={setShowDialog} />
    </>
  );
}
