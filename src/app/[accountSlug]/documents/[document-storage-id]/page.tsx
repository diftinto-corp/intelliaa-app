"use client";
import { useEffect, useState } from "react";

import { Pdf_Doc, DocumentStorage } from "@/interfaces/intelliaa";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import {
  getDocumentsPDFforDocumentStorage,
  getDocumentStorageById,
} from "@/lib/actions/intelliaa/documents";
import DocumentViewer from "@/components/intelliaa/assistants/documents/documentViewer/document-viewer";

//TODO: Agregar renderizado condicional con loading

export default function DocumentPage() {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const documentStorageId = pathname.split("/")[3];
  const [documents, setDocuments] = useState<Pdf_Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentSelected, setDocumentSelected] = useState(documents[0]?.id);
  const [documentUrl, setDocumentUrl] = useState(documents[0]?.url);
  const [account_id, setAccountId] = useState("");

  const supabase = createClient();

  useEffect(() => {
    const fetchDocuments = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const account_id = team_account.account_id;

      const newDocuments: any = await getDocumentsPDFforDocumentStorage(
        account_id,
        documentStorageId
      );

      if (!documents) return;
      setAccountId(account_id);
      setDocuments([...newDocuments]);
      setDocumentSelected(newDocuments[0]?.id);
      setDocumentUrl(newDocuments[0]?.url);

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

  if (loading) {
    return (
      <div className='flex flex-col h-[92vh] items-center p-6'>
        <div className='flex w-full h-full gap-4'>
          <Skeleton className='flex flex-col w-[15%]  rounded p-2'>
            <Skeleton className='flex bg-zinc-900 w-full h-[50px] my-2 flex-col'></Skeleton>
            <Skeleton className='flex bg-zinc-900 w-full h-[20px] my-2 flex-col'></Skeleton>
            <Skeleton className='flex bg-zinc-900 w-full h-[50px] my-2  flex-col'></Skeleton>
          </Skeleton>
          <Skeleton className='flex flex-col w-[85%]  rounded p-2'>
            <Skeleton className='flex bg-zinc-900 w-full h-[30px] my-2 flex-col'></Skeleton>
            <div className='flex gap-4'>
              <Skeleton className='flex bg-zinc-900 w-[50%] h-[80vh] my-2 flex-col'></Skeleton>
              <Skeleton className='flex bg-zinc-900 w-[50%] h-[80vh] my-2 flex-col'></Skeleton>
            </div>
          </Skeleton>
        </div>
      </div>
    );
  }

  return (
    <DocumentViewer
      documentsListPage={documents}
      account_id={account_id}
      documentStorageId={documentStorageId}
      documentSelected={documentSelected}
      setDocumentSelected={setDocumentSelected}
      accountSlug={accountSlug}
    />
  );
}
