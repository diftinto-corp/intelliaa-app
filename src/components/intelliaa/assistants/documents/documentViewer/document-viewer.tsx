"use client";

import { useState, useEffect } from "react";
import { DocumentList } from "./document-list";
import { AddDocumentForm } from "./add-document-form";
import { PDFViewer } from "./pdf-viewer";
import { QASection } from "./qa-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentStorage, Pdf_Doc, QAItem } from "@/interfaces/intelliaa";
import ModalAddFile from "../ModalAddFile";
import { addQa } from "@/lib/actions/intelliaa/qa";
import {
  deletePdf,
  getDocumentCounts,
} from "@/lib/actions/intelliaa/documents";
import { useRouter } from "next/navigation";
import { getDocumentStorageById } from "@/lib/actions/intelliaa/documents";
import { Skeleton } from "@/components/ui/skeleton";
export default function DocumentViewer({
  account_id,
  documentsListPage,
  documentStorageId,
  documentSelected,
  setDocumentSelected,
  accountSlug,
  loading,
}: {
  account_id: string;
  documentsListPage: Pdf_Doc[];
  documentStorageId: string;
  documentSelected: string;
  setDocumentSelected: (id: string) => void;
  accountSlug: string;
  loading: boolean;
}) {
  const router = useRouter();
  const [documentStorageNamespace, setDocumentStorageNamespace] = useState("");

  useEffect(() => {
    const getIsLastDocument = async () => {
      const documentCounts = await getDocumentCounts(documentStorageId);
      if (documentCounts.length === 0) {
        router.push(`/${accountSlug}/documents`);
      }
    };
    const getDocumentStorageNamespace = async () => {
      const documentStorage = await getDocumentStorageById(documentStorageId);
      if (documentStorage && documentStorage.length > 0) {
        setDocumentStorageNamespace(documentStorage[0].namespace);
      }
    };

    getIsLastDocument();
    getDocumentStorageNamespace();
  }, []);

  const filename = `complementary_${Math.random()
    .toString(36)
    .substring(2, 15)}`;

  const selectedDocument = documentsListPage.find(
    (doc) => doc.id === documentSelected
  );

  return (
    <div className='w-[95%] mx-auto p-4'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold text-primary'>
          Gestión de Documentos
        </h1>
      </div>
      {loading ? (
        <div className='flex flex-col h-[92vh] items-center p-6'>
          <div className='flex w-full h-full gap-4'>
            <Skeleton className='flex flex-col w-[15%]  rounded p-2'>
              <Skeleton className='flex dark:bg-zinc-900 bg-zinc-100 w-full h-[50px] my-2 flex-col'></Skeleton>
              <Skeleton className='flex dark:bg-zinc-900 bg-zinc-100 w-full h-[20px] my-2 flex-col'></Skeleton>
              <Skeleton className='flex dark:bg-zinc-900 bg-zinc-100 w-full h-[50px] my-2  flex-col'></Skeleton>
            </Skeleton>
            <Skeleton className='flex flex-col w-[85%]  rounded p-2'>
              <Skeleton className='flex dark:bg-zinc-900 bg-zinc-100 w-full h-[30px] my-2 flex-col'></Skeleton>
              <div className='flex gap-4'>
                <Skeleton className='flex dark:bg-zinc-900 bg-zinc-100 w-[100%] h-[80vh] my-2 flex-col'></Skeleton>
              </div>
            </Skeleton>
          </div>
        </div>
      ) : (
        <div className='grid md:grid-cols-12 gap-6'>
          <div className='md:col-span-12'>
            {selectedDocument && (
              <Tabs defaultValue='viewer'>
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger
                    className='data-[state=active]:bg-green-100 data-[state=active]:text-primary dark:data-[state=active]:bg-[#182426] dark:data-[state=active]:text-primary'
                    value='viewer'>
                    Documentos PDF
                  </TabsTrigger>
                  <TabsTrigger
                    className='data-[state=active]:bg-green-100 data-[state=active]:text-primary dark:data-[state=active]:bg-[#182426] dark:data-[state=active]:text-primary'
                    value='qa'>
                    Texto Complementario
                  </TabsTrigger>
                </TabsList>
                <TabsContent value='viewer'>
                  <div className='flex w-full h-full'>
                    <div className='md:col-span-4 h-full mr-4'>
                      <DocumentList
                        account_id={account_id}
                        documents={documentsListPage}
                        selectedDoc={documentSelected}
                        onSelectDocument={setDocumentSelected}
                        documentStorageId={documentStorageId}
                        documentStorageNamespace={documentStorageNamespace}
                      />
                    </div>
                    <PDFViewer pdfUrl={selectedDocument.url} />
                  </div>
                </TabsContent>
                <TabsContent value='qa'>
                  <QASection
                    account_id={account_id}
                    documentStorageId={documentStorageId}
                    documentName={selectedDocument.name}
                    filename={filename}
                    documentStorageNamespace={documentStorageNamespace}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
