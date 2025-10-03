"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUp, Loader2, CheckCircle2, XCircle, Upload } from "lucide-react";
import { uploadPdfToExistingStorage } from "@/lib/actions/intelliaa/documents";
import { useToast } from "@/components/ui/use-toast";

interface UploadPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentStorageId: string;
  accountId: string;
  onSuccess?: () => void;
}

type ProcessingStep = "idle" | "validating" | "embedding" | "knowledge-base" | "saving" | "complete" | "error";

const stepLabels: Record<ProcessingStep, string> = {
  idle: "Listo para subir",
  validating: "Validando archivo",
  embedding: "Generando embeddings",
  "knowledge-base": "Actualizando base de conocimientos",
  saving: "Guardando documento",
  complete: "Completado",
  error: "Error",
};

const stepProgress: Record<ProcessingStep, number> = {
  idle: 0,
  validating: 20,
  embedding: 40,
  "knowledge-base": 60,
  saving: 80,
  complete: 100,
  error: 0,
};

export function UploadPdfModal({
  open,
  onOpenChange,
  documentStorageId,
  accountId,
  onSuccess,
}: UploadPdfModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessingStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError(null);
    setCurrentStep("idle");

    if (selectedFile) {
      // Client-side validation
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError("El archivo excede el límite de 50MB");
        setFile(null);
        return;
      }

      if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
        setError("Solo se permiten archivos PDF");
        setFile(null);
        return;
      }

      if (selectedFile.size === 0) {
        setError("El archivo está vacío");
        setFile(null);
        return;
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Step 1: Validating
      setCurrentStep("validating");
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Prepare FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentStorageId", documentStorageId);
      formData.append("accountId", accountId);

      // Step 2: Embedding
      setCurrentStep("embedding");

      // Step 3: Knowledge Base (server handles this)
      const uploadPromise = uploadPdfToExistingStorage(formData);

      // Simulate progress for better UX
      setTimeout(() => setCurrentStep("knowledge-base"), 1000);
      setTimeout(() => setCurrentStep("saving"), 2000);

      const result = await uploadPromise;

      if (!result.success) {
        throw new Error(result.error || "Error al subir el archivo");
      }

      // Step 4: Complete
      setCurrentStep("complete");

      toast({
        title: "Documento subido exitosamente",
        description: `${file.name} ha sido procesado y agregado al almacenamiento.`,
      });

      // Reset and close after short delay
      setTimeout(() => {
        setFile(null);
        setCurrentStep("idle");
        setUploading(false);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);

    } catch (err) {
      console.error("Upload error:", err);
      setCurrentStep("error");
      setError(err instanceof Error ? err.message : "Error desconocido al subir el archivo");
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (!uploading) {
      setFile(null);
      setError(null);
      setCurrentStep("idle");
      onOpenChange(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setCurrentStep("idle");
    handleUpload();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agregar Documento PDF</DialogTitle>
          <DialogDescription>
            Sube un archivo PDF para agregar al almacenamiento. Máximo 50MB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Dropzone */}
          {!file && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary"}
              `}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                Arrastra un archivo PDF aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-gray-400">Máximo 50MB</p>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
          )}

          {/* Selected File */}
          {file && !uploading && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileUp className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFileSelect(null)}
              >
                Cambiar
              </Button>
            </div>
          )}

          {/* Processing Status */}
          {uploading && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                {currentStep === "complete" ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : (
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{file?.name}</p>
                  <p className="text-xs text-gray-500">{stepLabels[currentStep]}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{stepLabels[currentStep]}</span>
                  <span>{stepProgress[currentStep]}%</span>
                </div>
                <Progress value={stepProgress[currentStep]} className="h-2" />
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                {(["validating", "embedding", "knowledge-base", "saving"] as const).map((step) => (
                  <div
                    key={step}
                    className={`
                      p-2 rounded text-center transition-colors
                      ${currentStep === step ? "bg-blue-100 text-blue-700" : ""}
                      ${stepProgress[currentStep] > stepProgress[step] ? "bg-green-100 text-green-700" : ""}
                      ${stepProgress[currentStep] < stepProgress[step] ? "bg-gray-100 text-gray-500" : ""}
                    `}
                  >
                    {step === "validating" && "Validar"}
                    {step === "embedding" && "Embeddings"}
                    {step === "knowledge-base" && "KB"}
                    {step === "saving" && "Guardar"}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={uploading}
            >
              {uploading ? "Procesando..." : "Cancelar"}
            </Button>

            {currentStep === "error" ? (
              <Button onClick={handleRetry} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            ) : (
              <Button
                onClick={handleUpload}
                disabled={!file || uploading || currentStep === "complete"}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Subir Documento
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
