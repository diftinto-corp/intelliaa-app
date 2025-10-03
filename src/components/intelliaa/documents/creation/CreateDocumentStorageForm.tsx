"use client";

/**
 * INTEL-004: Create Document Storage Form Component
 *
 * Main form orchestrator for document storage creation
 * - Form validation with react-hook-form
 * - Multi-step processing state management
 * - Real-time file validation
 * - Error handling with retry capability
 * - Success state with auto-redirect
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createDocumentStorageWithPDF } from "@/lib/actions/intelliaa/documents";
import { FileDropzone } from "./FileDropzone";
import { ProcessingProgress } from "./ProcessingProgress";
import { validateFile, validateName } from "./validation";
import type {
  CreateDocumentStorageFormData,
  CreateDocumentStorageFormProps,
  ProcessingState,
  ProcessingError,
} from "./types";

export function CreateDocumentStorageForm({
  accountId,
  onSuccess,
  onCancel,
}: CreateDocumentStorageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateDocumentStorageFormData>({
    defaultValues: {
      name: "",
      description: "",
      file: null,
    },
  });

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();

  // Processing state
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [processingError, setProcessingError] = useState<ProcessingError | undefined>();

  // Watch form values
  const name = watch("name");

  // Handle file selection
  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setValue("file", file);

    // Validate file
    const validation = validateFile(file);
    if (validation) {
      setFileError(validation.message);
    } else {
      setFileError(undefined);
    }
  };

  // Handle form submission
  const onSubmit = async (data: CreateDocumentStorageFormData) => {
    // Final validation
    if (!selectedFile) {
      setFileError("Por favor, selecciona un archivo PDF");
      return;
    }

    const fileValidation = validateFile(selectedFile);
    if (fileValidation) {
      setFileError(fileValidation.message);
      return;
    }

    const nameValidation = validateName(data.name);
    if (nameValidation) {
      return; // react-hook-form will show the error
    }

    // Reset error state
    setProcessingError(undefined);
    setProcessingState('validating');

    // Create FormData
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', data.name.trim());
    formData.append('description', data.description.trim());
    formData.append('accountId', accountId);

    startTransition(async () => {
      try {
        // Simulate validation step
        await new Promise(resolve => setTimeout(resolve, 500));
        setProcessingState('uploading');

        // Call server action
        const response = await createDocumentStorageWithPDF(formData);

        if (response.success) {
          setProcessingState('success');

          // Wait a moment to show success state
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Redirect to detail page
          router.push(`/documents/${response.storageId}`);

          // Call success callback
          onSuccess(response.storageId);
        } else {
          // Handle error
          setProcessingState('error');
          setProcessingError({
            message: response.error,
            step: response.step,
            retryable: response.retryable,
            technicalDetails: response.technicalDetails,
          });
        }
      } catch (error) {
        setProcessingState('error');
        setProcessingError({
          message: 'Error inesperado al procesar el documento',
          step: 'validation' as any,
          retryable: true,
        });
      }
    });
  };

  // Handle retry
  const handleRetry = () => {
    setProcessingState('idle');
    setProcessingError(undefined);
  };

  const isProcessing = processingState !== 'idle' && processingState !== 'error';
  const canSubmit = !isProcessing && selectedFile && name.trim().length >= 3;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name field */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          {...register("name", {
            required: "El nombre es requerido",
            minLength: {
              value: 3,
              message: "El nombre debe tener al menos 3 caracteres",
            },
            maxLength: {
              value: 100,
              message: "El nombre no puede exceder 100 caracteres",
            },
            validate: (value) => {
              const validation = validateName(value);
              return validation ? validation.message : true;
            },
          })}
          placeholder="Ej: Manual de usuario 2024"
          disabled={isProcessing}
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Description field */}
      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Textarea
          id="description"
          {...register("description", {
            maxLength: {
              value: 500,
              message: "La descripción no puede exceder 500 caracteres",
            },
          })}
          placeholder="Describe brevemente el contenido del documento..."
          disabled={isProcessing}
          rows={3}
          className={errors.description ? "border-destructive" : ""}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* File dropzone */}
      <div className="space-y-2">
        <Label>
          Archivo PDF <span className="text-destructive">*</span>
        </Label>
        <FileDropzone
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          error={fileError}
          disabled={isProcessing}
        />
      </div>

      {/* Processing progress */}
      {processingState !== 'idle' && (
        <ProcessingProgress
          currentState={processingState}
          error={processingError}
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancelar
        </Button>

        {processingState === 'error' && processingError?.retryable ? (
          <Button type="button" onClick={handleRetry}>
            Reintentar
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!canSubmit || isPending}
          >
            {isProcessing ? 'Procesando...' : 'Crear Documento'}
          </Button>
        )}
      </div>
    </form>
  );
}
