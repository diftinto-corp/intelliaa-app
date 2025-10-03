"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { uploadPdfToExistingStorage } from "@/lib/actions/intelliaa/documents";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { Loader2, CheckCircle2, XCircle, FileUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Definimos la interfaz para los datos del formulario
interface FormInputs {
  pdfFile: FileList;
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

export default function FormaAddDoc({
  setOpenModal,
  documentStorageId,
  documentStorageNamespace,
}: {
  setOpenModal: any;
  documentStorageId: string;
  documentStorageNamespace: string;
}) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormInputs>();
  const [account_id, setAccount_id] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessingStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const selectedFile = watch("pdfFile")?.[0];

  useEffect(() => {
    const getaccountId = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      setAccount_id(team_account?.account_id as string);
    };
    getaccountId();
  }, [accountSlug]);

  // Client-side validation
  useEffect(() => {
    if (selectedFile) {
      setError(null);

      if (selectedFile.size > 50 * 1024 * 1024) {
        setError("El archivo excede el límite de 50MB");
      } else if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
        setError("Solo se permiten archivos PDF");
      } else if (selectedFile.size === 0) {
        setError("El archivo está vacío");
      }
    }
  }, [selectedFile]);

  const createDocumentStorageForm = async (data: FormInputs) => {
    if (!account_id) {
      setError("No se pudo obtener el ID de la cuenta");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Validating
      setCurrentStep("validating");
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Prepare FormData
      const formDataToSend = new FormData();
      formDataToSend.append("file", data.pdfFile[0]);
      formDataToSend.append("documentStorageId", documentStorageId);
      formDataToSend.append("accountId", account_id);

      // Step 2: Embedding
      setCurrentStep("embedding");

      // Execute upload with progress simulation
      const uploadPromise = uploadPdfToExistingStorage(formDataToSend);

      setTimeout(() => setCurrentStep("knowledge-base"), 1000);
      setTimeout(() => setCurrentStep("saving"), 2000);

      const result = await uploadPromise;

      if (!result.success) {
        throw new Error(result.error || "Error al subir el archivo");
      }

      // Step 3: Complete
      setCurrentStep("complete");

      // Check if file was renamed due to duplicate
      const wasRenamed = result.data?.wasRenamed;
      const finalFileName = result.data?.fileName || data.pdfFile[0].name;

      toast({
        title: "Documento subido exitosamente",
        description: wasRenamed
          ? `El archivo fue renombrado a "${finalFileName}" porque ya existía un archivo con el mismo nombre.`
          : `${data.pdfFile[0].name} ha sido procesado y agregado al almacenamiento.`,
        variant: wasRenamed ? "default" : "default",
      });

      // Close modal after short delay
      setTimeout(() => {
        setOpenModal(false);
        setCurrentStep("idle");
      }, wasRenamed ? 2500 : 1500); // Give user more time to read rename message

    } catch (err) {
      console.error("Upload error:", err);
      setCurrentStep("error");
      setError(err instanceof Error ? err.message : "Error desconocido al subir el archivo");

      toast({
        title: "Error al subir documento",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-muted-foreground'
      onSubmit={handleSubmit(createDocumentStorageForm)}>

      {/* File Input */}
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='pdfFile'>Archivo PDF (máx. 50MB)</Label>
        <Input
          type='file'
          id='pdfFile'
          accept='.pdf,application/pdf'
          disabled={loading}
          {...register("pdfFile", {
            required: "El archivo PDF es requerido",
          })}
        />
        {errors.pdfFile && (
          <span className='text-sm text-red-500'>{errors.pdfFile.message}</span>
        )}
      </div>

      {/* Selected File Info */}
      {selectedFile && !loading && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <FileUp className="h-5 w-5 text-blue-500" />
          <div className="flex-1">
            <p className="text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            {currentStep === "complete" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedFile?.name}</p>
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
        </div>
      )}

      {/* Error Alert */}
      {error && !loading && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button type='submit' disabled={loading || !!error || currentStep === "complete"}>
        {loading ? (
          <>
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            {stepLabels[currentStep]}...
          </>
        ) : currentStep === "complete" ? (
          <>
            <CheckCircle2 className='mr-2 h-4 w-4' />
            Completado
          </>
        ) : (
          "Subir Documento"
        )}
      </Button>
    </form>
  );
}
