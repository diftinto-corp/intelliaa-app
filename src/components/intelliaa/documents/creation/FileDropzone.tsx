"use client";

/**
 * INTEL-004: File Dropzone Component
 *
 * Drag-and-drop file upload component with validation
 * - Native HTML5 drag-and-drop (no external library)
 * - Visual feedback for all states
 * - Keyboard accessible
 * - Touch-friendly for mobile
 */

import { useCallback, useState } from "react";
import { Upload, X, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateFile, formatFileSize } from "./validation";
import type { FileDropzoneProps } from "./types";

export function FileDropzone({
  onFileSelect,
  selectedFile,
  error,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Handle file selection (either via click or drop)
  const handleFileSelection = useCallback(
    (file: File | null) => {
      if (!file) {
        onFileSelect(null);
        return;
      }

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        // Let parent component handle validation error display
        onFileSelect(null);
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect]
  );

  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelection(file);
  };

  // Drag event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);
    setDragCounter(0);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  // Remove file handler
  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      document.getElementById("file-upload-input")?.click();
    }
  };

  return (
    <div className="w-full">
      {/* Dropzone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-all duration-200",
          "hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          isDragging && "border-primary bg-primary/5 scale-[1.02]",
          error && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed",
          !selectedFile && !disabled && "cursor-pointer"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !selectedFile && !disabled && document.getElementById("file-upload-input")?.click()}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Seleccionar archivo PDF"
      >
        {/* Hidden file input */}
        <input
          id="file-upload-input"
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
          aria-hidden="true"
        />

        {/* Content */}
        <div className="p-6">
          {selectedFile ? (
            // Selected file display
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>

                  {!disabled && (
                    <button
                      onClick={handleRemoveFile}
                      className={cn(
                        "flex-shrink-0 p-1 rounded-md transition-colors",
                        "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      )}
                      aria-label="Eliminar archivo"
                      type="button"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Empty state
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className={cn(
                  "w-6 h-6 transition-transform",
                  isDragging && "scale-110 text-primary",
                  !isDragging && "text-muted-foreground"
                )} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {isDragging ? (
                    "Suelta el archivo aquí"
                  ) : (
                    <>
                      <span className="text-primary">Haz clic para seleccionar</span>
                      {" "}o arrastra un archivo PDF
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tamaño máximo: 50 MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/5 rounded-lg pointer-events-none" />
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Helper text */}
      {!error && !selectedFile && (
        <p className="mt-2 text-xs text-muted-foreground">
          Solo se permiten archivos PDF. El archivo será procesado para crear embeddings y almacenarlo en tu base de conocimientos.
        </p>
      )}
    </div>
  );
}
