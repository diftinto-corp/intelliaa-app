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
export default function DocumentViewer({
  account_id,
  documentsListPage,
  documentStorageId,
  documentSelected,
  setDocumentSelected,
  accountSlug,
}: {
  account_id: string;
  documentsListPage: Pdf_Doc[];
  documentStorageId: string;
  documentSelected: string;
  setDocumentSelected: (id: string) => void;
  accountSlug: string;
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

  const deleteQA = (index: number) => {};

  const selectedDocument = documentsListPage.find(
    (doc) => doc.id === documentSelected
  );

  return (
    <div className='w-[95%] mx-auto p-4'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold text-primary'>
          Gestión de Documentos
        </h1>
        <ModalAddFile
          documentStorageId={documentStorageId}
          documentStorageNamespace={documentStorageNamespace}
        />
      </div>

      <div className='grid md:grid-cols-12 gap-6'>
        <div className='md:col-span-4'>
          <DocumentList
            account_id={account_id}
            documents={documentsListPage}
            selectedDoc={documentSelected}
            onSelectDocument={setDocumentSelected}
            documentStorageId={documentStorageId}
            documentStorageNamespace={documentStorageNamespace}
          />
        </div>

        <div className='md:col-span-8'>
          {selectedDocument && (
            <Tabs defaultValue='viewer'>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger
                  className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
                  value='viewer'>
                  Visor PDF
                </TabsTrigger>
                <TabsTrigger
                  className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
                  value='qa'>
                  Preguntas y Respuestas
                </TabsTrigger>
              </TabsList>
              <TabsContent value='viewer'>
                <PDFViewer pdfUrl={selectedDocument.url} />
              </TabsContent>
              <TabsContent value='qa'>
                <QASection
                  account_id={account_id}
                  documentStorageId={documentStorageId}
                  documentName={selectedDocument.name}
                  filename={filename}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
