"use client";

import { Pdf_Doc } from "@/interfaces/intelliaa";
import FormAddDocComponent from "./FormAddDoc";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { GetAllAssistants } from "@/lib/actions/intelliaa/assistants";
import ModalAddDocument from "./ModalAddDocument";
import DetailsDocuments from "./DetailsDocuments";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ConfigDocuments({
  documentsListPage,
  documentSelected,
  setDocumentSelected,
}: {
  documentsListPage: Pdf_Doc[];
  documentSelected: string;
  setDocumentSelected: Function;
}) {
  const [s3_key, setS3_key] = useState(documentsListPage[0]?.s3_key);

  const handleSelectDocument = (id: string, s3_key: string) => {
    setDocumentSelected(id);
    setS3_key(s3_key);
  };

  return (
    <div className='flex flex-col h-[92vh] items-center p-6'>
      <div className='flex w-full h-full gap-4'>
        <div className='flex flex-col bg-background w-[15%] border rounded p-2'>
          <div className='flex flex-col'>
            <ModalAddDocument />
          </div>
          <p className='text-left text-xl font-semibold  text-muted-foreground  my-4'>
            Documentos:{" "}
          </p>
          <ScrollArea className='flex flex-col gap-2'>
            {documentsListPage.map((document) => (
              <div
                key={document.id}
                className={`flex items-center gap-4 justify-between rounded-sm px-3 py-2 border hover:bg-teal-900 text-sm text-muted-foreground font-semibold hover:text-primary cursor-pointer ${
                  documentSelected === document.id
                    ? "bg-teal-900 text-primary"
                    : ""
                }`}
                onClick={() =>
                  handleSelectDocument(document.id, document.s3_key)
                }>
                <p>{document.name}</p>
                <FileText />
              </div>
            ))}
          </ScrollArea>
        </div>
        <div className='flex flex-col bg-background w-[85%] border rounded p-2'>
          <div className='flex flex-col'>
            <DetailsDocuments
              documentSelected={documentSelected}
              documentKey={s3_key}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
