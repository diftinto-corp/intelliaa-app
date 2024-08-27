"use client";

import { Pdf_Doc } from "@/interfaces/intelliaa";
import {
  deletePdfS3,
  deletePdf_Doc,
  getPdf_Doc,
  searchAssistantByDocument,
} from "@/lib/actions/intelliaa/documents";
import { useEffect, useState } from "react";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import ModalDeleteDocument from "./ModalDeleteDocument";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { set } from "date-fns";

export default function DetailsDocuments({
  documentSelected,
  documentKey,
  documentIdVapiDoc,
}: {
  documentSelected: string;
  documentKey: string;
  documentIdVapiDoc: string;
}) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const [DocumentPdf, setDocumentPdf] = useState<Pdf_Doc>({} as Pdf_Doc);
  const [accountId, setAccountId] = useState<string>("" as string);
  const [loading, setLoading] = useState(true);
  const [assistantsName, setAssistantsName] = useState<string[]>(
    [] as string[]
  );

  console.log(assistantsName);

  useEffect(() => {
    const getAssistantsName = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const account_id = team_account?.account_id;
      setAccountId(account_id as string);
      const assistants = await searchAssistantByDocument(
        account_id,
        documentKey,
        documentIdVapiDoc
      );

      if (assistants) {
        setAssistantsName(assistants as string[]);
      }
    };

    getAssistantsName();
  }, []);

  useEffect(() => {
    const fetchDocument = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const account_id = team_account?.account_id;
      setAccountId(account_id as string);
      const document = await getPdf_Doc(account_id, documentSelected);
      setDocumentPdf(document as unknown as Pdf_Doc);
      const assistants = await searchAssistantByDocument(
        account_id,
        document.s3_key,
        document.id_vapi_doc
      );
      setAssistantsName(assistants as string[]);
    };
    fetchDocument();
    setLoading(false);
  }, [documentSelected]);

  const handleDelete = async () => {
    setLoading(true);
    await deletePdfS3(DocumentPdf.s3_key);
    await deletePdf_Doc(accountId, DocumentPdf.id, DocumentPdf.id_vapi_doc);
    setLoading(false);
  };

  return (
    <div>
      <p className='text-left text-xl font-semibold text-muted-foreground my-4'>
        {DocumentPdf?.name}
      </p>
      <div className='flex w-full gap-4'>
        <div className='flex flex-col gap-2 w-[50%] h-[78vh] rounded overflow-hidden'>
          <iframe
            className='rounded w-full h-full'
            src={DocumentPdf?.url}
            allow='fullscreen'
            allowFullScreen></iframe>
        </div>
        <div className='flex flex-col gap-4 w-[50%] pl-6'>
          <div className='flex flex-col w-[80%]'>
            <p className='text-left text-lg font-semibold text-muted-foreground my-4'>
              Resumen:
            </p>
            <p className='text-left text-sm font-semibold text-muted-foreground my-4 h-[100px] overflow-hidden'>
              {DocumentPdf?.description}
            </p>
            <div className='flex gap-4 w-full justify-between'>
              <div className='flex flex-col w-full'>
                {assistantsName.length > 0 && (
                  <div>
                    <p className='text-left text-lg font-semibold text-primary my-4'>
                      Asistentes asignados:
                    </p>
                    <div className='flex flex-col gap-2'>
                      {assistantsName.map((assistant) => (
                        <p
                          key={assistant}
                          className='text-left text-sm text-muted-foreground'>
                          {assistant}
                        </p>
                      ))}
                      <p className='text-left text-sm text-muted-foreground mt-4'>
                        <span className='text-primary font-semibold'>
                          Nota:
                        </span>{" "}
                        Para eliminar un documento no debes tener ningún
                        asistente asignado.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className='flex flex-col gap-4 items-start'>
                <Button
                  variant='outline'
                  size='icon'
                  className='text-red-600 hover:bg-red-50 hover:text-red-500'
                  onClick={handleDelete}
                  disabled={assistantsName.length > 0 || loading}>
                  {loading ? (
                    <div className='flex items-center gap-2'>
                      <Loader2 size={17} />
                    </div>
                  ) : (
                    <div className='flex items-center gap-2'>
                      <Trash2 size={17} />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
