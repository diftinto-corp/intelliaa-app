"use client";

import { Trash2, FileText, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { deletePdfDocument } from "@/lib/actions/intelliaa/documents";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ModalAddFile from "../ModalAddFile";
import { useToast } from "@/lib/hooks/use-toast";

interface Document {
  id: string;
  name: string;
  document_storage_id: string;
  id_vapi_doc: string;
}

interface DocumentListProps {
  account_id: string;
  documents: Document[];
  selectedDoc: string;
  onSelectDocument: (id: string) => void;
  documentStorageId: string;
  documentStorageNamespace: string;
  accountSlug: string;
}

export function DocumentList({
  account_id,
  documents,
  selectedDoc,
  onSelectDocument,
  documentStorageId,
  documentStorageNamespace,
  accountSlug,
}: DocumentListProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [loadingDeleteMap, setLoadingDeleteMap] = useState<
    Record<string, boolean>
  >({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  const isLastDocument = documents.length === 1;

  const handleDeleteClick = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    const docId = documentToDelete.id;

    try {
      setLoadingDeleteMap((prev) => ({ ...prev, [docId]: true }));

      const result = await deletePdfDocument(
        documentStorageId,
        docId,
        account_id
      );

      if (result.status === 'error') {
        toast({
          title: "Error al eliminar",
          description: result.message || "Error desconocido",
          variant: "destructive",
        });
        return;
      }

      // Success
      toast({
        title: result.storageDeleted ? "Almacenamiento eliminado" : "Documento eliminado",
        description: result.message,
        variant: "default",
      });

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning, index) => {
          setTimeout(() => {
            toast({
              title: "Advertencia",
              description: warning,
              variant: "default",
            });
          }, (index + 1) * 300); // Stagger warnings
        });
      }

      // Redirect if storage was deleted
      if (result.storageDeleted) {
        setTimeout(() => {
          router.push(`/${accountSlug}/documents`);
        }, 1000);
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Error inesperado al eliminar documento",
        variant: "destructive",
      });
      console.error('[DocumentList] Delete error:', error);
    } finally {
      setLoadingDeleteMap((prev) => ({ ...prev, [docId]: false }));
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  return (
    <>
      <Card className='h-[80vh] overflow-y-auto'>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
          <CardDescription>Lista de documentos PDF</CardDescription>
          <ModalAddFile
            documentStorageId={documentStorageId}
            documentStorageNamespace={documentStorageNamespace}
          />
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  selectedDoc === doc.id
                    ? "bg-secondary"
                    : "hover:bg-secondary/50"
                } cursor-pointer`}
                onClick={() => onSelectDocument(doc.id)}>
                <div className='flex items-center'>
                  <FileText className='w-4 h-4 mr-2' />
                  <span>{doc.name}</span>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  disabled={loadingDeleteMap[doc.id]}
                  onClick={(e) => handleDeleteClick(doc, e)}
                  aria-label={`Eliminar documento ${doc.name}`}>
                  {loadingDeleteMap[doc.id] ? (
                    <Loader2 className='w-4 h-4 animate-spin text-destructive' />
                  ) : (
                    <Trash2 className='w-4 h-4 text-destructive' />
                  )}
                  <span className='sr-only'>Eliminar documento {doc.name}</span>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* INTEL-006: Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Estás a punto de eliminar el documento:{" "}
                <strong className="text-foreground">{documentToDelete?.name}</strong>
              </p>

              {isLastDocument && (
                <div className="flex items-start gap-2 p-3 mt-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-destructive">Advertencia:</p>
                    <p className="text-muted-foreground mt-1">
                      Este es el último documento del almacenamiento. Al eliminarlo,
                      el almacenamiento completo también será eliminado.
                    </p>
                  </div>
                </div>
              )}

              <p className="mt-2 text-sm">
                Esta acción no se puede deshacer.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingDeleteMap[documentToDelete?.id || '']}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={loadingDeleteMap[documentToDelete?.id || '']}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loadingDeleteMap[documentToDelete?.id || ''] ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
