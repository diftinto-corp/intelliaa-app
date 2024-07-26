"use client";

import { Pdf_Doc } from "@/interfaces/intelliaa";
import {
  deletePdfS3,
  deletePdf_Doc,
  getPdf_Doc,
} from "@/lib/actions/intelliaa/documents";
import { useEffect, useState } from "react";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import ModalDeleteDocument from "./ModalDeleteDocument";

export default function DetailsDocuments({
  documentSelected,
  documentKey,
}: {
  documentSelected: string;
  documentKey: string;
}) {
  const [DocumentPdf, setDocumentPdf] = useState<Pdf_Doc>({} as Pdf_Doc);
  const [accountId, setAccountId] = useState<string>("" as string);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocument = async () => {
      const account = await getAccount();
      const account_id = account?.account_id;
      setAccountId(account_id as string);
      const document = await getPdf_Doc(account_id, documentSelected);
      setDocumentPdf(document as unknown as Pdf_Doc);
    };
    fetchDocument();
    setLoading(false);
  }, [documentSelected]);

  const handleDelete = async () => {
    setLoading(true);
    await deletePdfS3(DocumentPdf.s3_key);
    await deletePdf_Doc(accountId, DocumentPdf.id);
    setLoading(false);
  };

  return (
    <div>
      <p className='text-left text-xl font-semibold  text-muted-foreground  my-4'>
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
          <div className='flex flex-col w-[80%] '>
            <p className='text-left text-lg font-semibold  text-muted-foreground  my-4'>
              Resumen:
            </p>
            <p className='text-left text-sm font-semibold  text-muted-foreground  my-4'>
              {DocumentPdf?.description}
            </p>
            <Button
              variant='outline'
              size='icon'
              className='  text-red-600 hover:bg-red-50 hover:text-red-500 self-end '
              onClick={handleDelete}>
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
  );
}
