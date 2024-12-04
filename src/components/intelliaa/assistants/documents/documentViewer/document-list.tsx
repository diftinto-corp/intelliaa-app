"use client";

import { Trash2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deletePdf,
  getDocumentCounts,
} from "@/lib/actions/intelliaa/documents";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import ModalAddFile from "../ModalAddFile";
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
}

export function DocumentList({
  account_id,
  documents,
  selectedDoc,
  onSelectDocument,
  documentStorageId,
  documentStorageNamespace,
}: DocumentListProps) {
  const [loadingDeleteMap, setLoadingDeleteMap] = useState<
    Record<string, boolean>
  >({});

  const deleteDocument = async (
    documentStorageId: string,
    id_vapi_doc: string,
    id: string
  ) => {
    try {
      setLoadingDeleteMap((prev) => ({ ...prev, [id]: true }));
      await deletePdf(
        documentStorageId,
        id_vapi_doc,
        id,
        documentStorageNamespace
      );
    } finally {
      setLoadingDeleteMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <Card>
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
                onClick={(e) => {
                  e.stopPropagation();
                  deleteDocument(
                    doc.document_storage_id,
                    doc.id_vapi_doc,
                    doc.id
                  );
                }}>
                {loadingDeleteMap[doc.id] ? (
                  <Loader2 className='w-4 h-4 animate-spin text-destructive' />
                ) : (
                  <Trash2 className='w-4 h-4 text-destructive' />
                )}
                <span className='sr-only'>Eliminar documento</span>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
