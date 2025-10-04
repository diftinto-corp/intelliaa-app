"use client";
import { useEffect, useState } from "react";

import { Pdf_Doc, DocumentStorage } from "@/interfaces/intelliaa";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import {
  getDocumentsPDFforDocumentStorage,
  getDocumentCounts,
  getDocumentStorageById,
  deleteDocumentStorageWithValidation,
  type DeleteDocumentStorageResponse
} from "@/lib/actions/intelliaa/documents";
import DocumentViewer from "@/components/intelliaa/assistants/documents/documentViewer/document-viewer";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

//TODO: Agregar renderizado condicional con loading

export default function DocumentPage() {
  const router = useRouter();
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const documentStorageId = pathname.split("/")[3];
  const [documents, setDocuments] = useState<Pdf_Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentSelected, setDocumentSelected] = useState(documents[0]?.id);
  const [documentUrl, setDocumentUrl] = useState(documents[0]?.url);
  const [account_id, setAccountId] = useState("");
  const [documentStorage, setDocumentStorage] = useState<any>(null);
  const [qaCount, setQaCount] = useState(0);
  const { toast } = useToast();

  const supabase = createClient();

  useEffect(() => {
    const fetchDocuments = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const account_id = team_account.account_id;

      // Fetch PDF documents
      const newDocuments: any = await getDocumentsPDFforDocumentStorage(
        account_id,
        documentStorageId
      );

      // Fetch document storage info
      const storageInfo = await getDocumentStorageById(documentStorageId);

      // Fetch document counts for QA
      const counts = await getDocumentCounts(documentStorageId);
      const qaDocuments = counts.filter((doc: any) => doc.vapiFileId);

      if (!documents) return;
      setAccountId(account_id);
      setDocuments([...newDocuments]);
      setDocumentSelected(newDocuments[0]?.id);
      setDocumentUrl(newDocuments[0]?.url);
      setDocumentStorage(storageInfo?.[0] || null);
      setQaCount(qaDocuments.length);

      setLoading(false);
    };

    fetchDocuments();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("pdf_docs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pdf_docs",
        },
        (payload: any) => {
          setDocuments([...documents, payload.new as Pdf_Doc]);
          setDocumentSelected(payload.new.id);
          setDocumentUrl(payload.new.url);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documents]);

  useEffect(() => {
    const channel = supabase
      .channel("pdf_docs_delete")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pdf_docs",
        },
        (payload: any) => {
          setDocuments(documents.filter((doc) => doc.id !== payload.old.id));
          setDocumentSelected(documents[0]?.id);
          setDocumentUrl(documents[0]?.url);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documents]);

  /**
   * INTEL-007: Delete document storage with comprehensive validation
   */
  const handleDeleteDocumentStorage = async (): Promise<DeleteDocumentStorageResponse> => {
    return await deleteDocumentStorageWithValidation(documentStorageId, account_id);
  };

  return (
    <DocumentViewer
      documentsListPage={documents}
      account_id={account_id}
      documentStorageId={documentStorageId}
      documentSelected={documentSelected}
      setDocumentSelected={setDocumentSelected}
      accountSlug={accountSlug}
      loading={loading}
      documentStorage={documentStorage}
      qaCount={qaCount}
      onDeleteStorage={handleDeleteDocumentStorage}
    />
  );
}
