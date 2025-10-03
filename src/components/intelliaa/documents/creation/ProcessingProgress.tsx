"use client";

/**
 * INTEL-004: Processing Progress Component
 *
 * Multi-step progress indicator for document storage creation
 * - 5 processing steps with visual feedback
 * - Percentage-based progress bar
 * - ARIA live region for screen readers
 * - Error state display
 */

import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PROCESSING_STEPS, type ProcessingProgressProps, type ProcessingState } from "./types";

const STATE_ORDER: ProcessingState[] = [
  'validating',
  'uploading',
  'embedding',
  'knowledge-base',
  'saving',
  'success',
];

const STATE_PERCENTAGE: Record<ProcessingState, number> = {
  idle: 0,
  validating: 10,
  uploading: 25,
  embedding: 50,
  'knowledge-base': 75,
  saving: 90,
  success: 100,
  error: 0,
};

export function ProcessingProgress({
  currentState,
  error,
}: ProcessingProgressProps) {
  const percentage = STATE_PERCENTAGE[currentState] || 0;
  const isProcessing = !['idle', 'success', 'error'].includes(currentState);
  const currentStepIndex = STATE_ORDER.indexOf(currentState);

  // Get step status
  const getStepStatus = (stepState: ProcessingState): 'completed' | 'active' | 'pending' | 'error' => {
    if (error && currentState === stepState) return 'error';

    const stepIndex = STATE_ORDER.indexOf(stepState);

    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  // Don't render if idle
  if (currentState === 'idle') {
    return null;
  }

  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-atomic="true">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {error ? 'Error al procesar' : PROCESSING_STEPS[currentState].label}
          </span>
          <span className="text-muted-foreground">{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      {/* Step indicators */}
      <div className="space-y-2">
        {STATE_ORDER.filter(s => s !== 'success').map((stepState) => {
          const status = getStepStatus(stepState);
          const stepMeta = PROCESSING_STEPS[stepState];

          return (
            <div
              key={stepState}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg transition-all",
                status === 'active' && "bg-primary/5 border border-primary/20",
                status === 'completed' && "opacity-60",
                status === 'pending' && "opacity-40"
              )}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {status === 'completed' && (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                )}
                {status === 'active' && (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
                {status === 'error' && (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                {status === 'pending' && (
                  <Clock className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-sm font-medium",
                    status === 'active' && "text-foreground",
                    status === 'completed' && "text-muted-foreground",
                    status === 'pending' && "text-muted-foreground",
                    status === 'error' && "text-destructive"
                  )}>
                    {stepMeta.label}
                  </p>
                  {status === 'active' && (
                    <span className="text-xs text-muted-foreground">
                      ({stepMeta.estimatedTime})
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stepMeta.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <p className="font-medium">{error.message}</p>
            {error.retryable && (
              <p className="mt-1 text-xs opacity-90">
                Este error es temporal. Puedes intentar nuevamente.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Success state */}
      {currentState === 'success' && (
        <Alert className="border-primary/20 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription className="ml-2 text-foreground">
            <p className="font-medium">Documento creado exitosamente</p>
            <p className="mt-1 text-xs text-muted-foreground">
              El documento ha sido procesado y está listo para usar en tus asistentes.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {isProcessing && `Procesando: ${PROCESSING_STEPS[currentState].description}`}
        {error && `Error: ${error.message}`}
        {currentState === 'success' && 'Documento creado exitosamente'}
      </div>
    </div>
  );
}
