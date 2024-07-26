"use client";
import { useEffect, useState } from "react";

import ModalAddDocument from "@/components/intelliaa/assistants/documents/ModalAddDocument";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { getAllPdf_Doc } from "@/lib/actions/intelliaa/documents";
import { Pdf_Doc } from "../../../interfaces/intelliaa";
import { createClient } from "@/lib/supabase/client";
import ConfigDocuments from "@/components/intelliaa/assistants/documents/ConfigDocuments";
import { Skeleton } from "@/components/ui/skeleton";

//TODO: Agregar renderizado condicional con loading

export default function DocumentPage() {
  const [documents, setDocuments] = useState<Pdf_Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentSelected, setDocumentSelected] = useState(documents[0]?.id);

  const supabase = createClient();

  useEffect(() => {
    const fetchDocuments = async () => {
      const account = await getAccount();
      const account_id = account.account_id;

      const newDocuments: any = await getAllPdf_Doc(account_id);
      if (!documents) return;
      setDocuments([...newDocuments]);
      setDocumentSelected(newDocuments[0]?.id);
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
            <Skeleton className='flex bg-teal-900 w-full h-[50px] my-2 flex-col'></Skeleton>
            <Skeleton className='flex bg-teal-900 w-full h-[20px] my-2 flex-col'></Skeleton>
            <Skeleton className='flex bg-teal-900 w-full h-[50px] my-2  flex-col'></Skeleton>
          </Skeleton>
          <Skeleton className='flex flex-col w-[85%]  rounded p-2'>
            <Skeleton className='flex bg-teal-900 w-full h-[30px] my-2 flex-col'></Skeleton>
            <div className='flex gap-4'>
              <Skeleton className='flex bg-teal-900 w-[50%] h-[80vh] my-2 flex-col'></Skeleton>
              <Skeleton className='flex bg-teal-900 w-[50%] h-[80vh] my-2 flex-col'></Skeleton>
            </div>
          </Skeleton>
        </div>
      </div>
    );
  }

  return (
    <>
      {documents.length > 0 ? (
        <ConfigDocuments
          documentsListPage={documents}
          documentSelected={documentSelected}
          setDocumentSelected={setDocumentSelected}
        />
      ) : (
        <div className='flex flex-col justify-center min-h-[90vh] items-center p-6'>
          <div className='flex w-[40%] flex-col justify-center items-center'>
            <p>Aún no has creado un asistente.</p>
            <p>
              Haga clic en el botón a continuación para agregar un nuevo
              asistente.
            </p>
            <ModalAddDocument />
          </div>
        </div>
      )}
    </>
  );
}
