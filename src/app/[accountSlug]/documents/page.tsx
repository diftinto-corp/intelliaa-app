"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package } from "lucide-react";
import ModalAddDocument from "@/components/intelliaa/assistants/documents/ModalAddDocument";
import { DocumentStorage, Pdf_Doc } from "../../../interfaces/intelliaa";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { getAllDocumentStorage } from "@/lib/actions/intelliaa/documents";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { deleteAllDocumentStorageById } from "@/lib/actions/intelliaa/documents";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

//TODO: Agregar renderizado condicional con loading

export default function DocumentStoragePage() {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const router = useRouter();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentStorage[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentSelected, setDocumentSelected] = useState(documents[0]?.id);

  const supabase = createClient();

  useEffect(() => {
    const fetchDocuments = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const account_id = team_account.account_id;

      const newDocuments: any = await getAllDocumentStorage(account_id);
      if (!documents) return;
      setDocuments([...newDocuments]);
      setDocumentSelected(newDocuments[0]?.id);
      setLoading(false);
    };

    fetchDocuments();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("document_storages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "document_storages",
        },
        (payload: any) => {
          setDocuments([...documents, payload.new as DocumentStorage]);
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
      .channel("document_storages_delete")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "document_storages",
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

  return (
    <>
      {documents.length > 0 || loading ? (
        <div className='min-h-[90vh] p-6'>
          <div className='flex justify-between'>
            <div className='flex flex-col mb-6'>
              <h3 className='text-muted-foreground text-2xl font-bold'>
                Document storages
              </h3>
              <p className='text-muted-foreground'>
                Aquí podrás ver los documentos almacenados en tu cuenta
                organizados por contextos.
              </p>
            </div>

            <ModalAddDocument />
          </div>
          {loading ? (
            <div className='flex flex-wrap gap-6 mt-6'>
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
              <Skeleton className='w-[30%] h-[200px] dark:bg-gray-800' />
            </div>
          ) : (
            <div className='flex flex-wrap gap-6 mt-6'>
              {documents.map((doc) => (
                <Card
                  key={doc.id}
                  className='w-[30%] flex flex-col p-4 text-muted-foreground pt-6 dark:bg-[#242322]/80 dark:border-gray-700 dark:shadow-[inset_0_0_20px_rgba(20,184,166,0.2)] overflow-y-auto dark:hover:bg-teal-900 transition-colors cursor-pointer'
                  onClick={() => router.push(`${pathname}/${doc.id}`)}>
                  <CardHeader>
                    <Package className='h-6 w-6 text-primary' />
                    <CardTitle className='text-muted-foreground'>
                      {doc.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{doc.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className='flex flex-col justify-center min-h-[90vh] items-center p-6'>
          <div className='flex w-[40%] flex-col justify-center items-center text-muted-foreground'>
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
