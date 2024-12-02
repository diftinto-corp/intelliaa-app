"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare, X, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QAItem } from "@/interfaces/intelliaa";
import {
  getAllQa,
  uploadTxt,
  updateQa,
  deleteQa,
} from "@/lib/actions/intelliaa/qa";
import { createClient } from "@/lib/supabase/client";
import { getDocumentCounts } from "@/lib/actions/intelliaa/documents";
import { addQa } from "@/lib/actions/intelliaa/qa";
import { vapiService } from "@/services/vapiService";

interface QA {
  question: string;
  answer: string;
}

interface QASectionProps {
  account_id: string;
  documentStorageId: string;
  documentName: string;
  filename: string;
}

export function QASection({
  account_id,
  documentStorageId,
  documentName,
  filename,
}: QASectionProps) {
  const [newQA, setNewQA] = useState<QA>({ question: "", answer: "" });
  const [qaDocs, setQaDocs] = useState<QAItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedQAIndex, setSelectedQAIndex] = useState<number | null>(null);
  const [loadingDeleteMap, setLoadingDeleteMap] = useState<
    Record<string, boolean>
  >({});

  const supabase = createClient();

  useEffect(() => {
    const GetQaDocs = async () => {
      const GetQaDocs = await getAllQa(documentStorageId);
      setQaDocs(GetQaDocs as QAItem[]);
    };

    GetQaDocs();
  }, [documentStorageId]);

  const handleAddQA = async () => {
    try {
      setIsGenerating(true);

      let content = "PREGUNTAS Y RESPUESTAS\n\n";
      const allQAs = [
        ...qaDocs,
        { question: newQA.question, answer: newQA.answer },
      ];
      allQAs.forEach((qa) => {
        content += `${qa.question}\n`;
        content += `${qa.answer}\n\n`;
      });

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const file = new File([blob], `${filename}.txt`, { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadTxt(
        account_id,
        documentStorageId,
        newQA.question,
        newQA.answer,
        formData
      );

      if (result.status === "error") {
        throw new Error(result.message);
      }

      setNewQA({ question: "", answer: "" });
    } catch (error) {
      console.error("Error al agregar Q&A y generar documento:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQAClick = (qa: QAItem, index: number) => {
    setNewQA({ question: qa.question, answer: qa.answer });
    setIsEditing(true);
    setSelectedQAIndex(index);
  };

  const handleUpdateQA = async () => {
    try {
      setIsGenerating(true);

      // 1. Eliminar el documento anterior en Vapi
      const qaToUpdate = qaDocs[selectedQAIndex!];
      console.log("QA a actualizar:", qaToUpdate);
      console.log("ID Vapi a eliminar:", qaToUpdate.vapiFileId);

      if (!qaToUpdate.vapiFileId) {
        console.error("No se encontró vapiFileId para el documento");
        return;
      }

      await vapiService.deleteFile(qaToUpdate.vapiFileId);

      // 2. Actualizar el array de QAs
      const updatedQAs = [...qaDocs];
      updatedQAs[selectedQAIndex!] = {
        ...updatedQAs[selectedQAIndex!],
        question: newQA.question,
        answer: newQA.answer,
      };

      // 3. Generar nuevo contenido
      let content = "PREGUNTAS Y RESPUESTAS\n\n";
      updatedQAs.forEach((qa) => {
        content += `${qa.question}\n`;
        content += `${qa.answer}\n\n`;
      });

      // 4. Subir nuevo archivo
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const file = new File([blob], `${filename}.txt`, { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadTxt(
        account_id,
        documentStorageId,
        newQA.question,
        newQA.answer,
        formData
      );

      if (result.status === "error") {
        throw new Error(result.message);
      }

      // 5. Actualizar en la base de datos
      await updateQa(
        account_id,
        newQA.question,
        newQA.answer,
        qaToUpdate.id,
        result.vapiFileId
      );

      // 6. Actualizar el estado local
      const updatedQaDocs = await getAllQa(documentStorageId);
      setQaDocs(updatedQaDocs as QAItem[]);

      // 7. Limpiar el formulario
      setNewQA({ question: "", answer: "" });
      setIsEditing(false);
      setSelectedQAIndex(null);
    } catch (error) {
      console.error("Error al actualizar Q&A:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("qa_docs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "qa_docs",
        },
        (payload: any) => {
          setQaDocs([...qaDocs, payload.new as QAItem]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qaDocs]);

  const deleteDocQa = async (
    documentStorageId: string,
    id_vapi_doc: string,
    id: string
  ) => {
    try {
      setLoadingDeleteMap((prev) => ({ ...prev, [id]: true }));
      await deleteQa(documentStorageId, id_vapi_doc, id);
    } finally {
      setLoadingDeleteMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("qa_docs_delete")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "qa_docs",
        },
        (payload: any) => {
          setQaDocs(qaDocs.filter((qa) => qa.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qaDocs]);

  return (
    <Card>
      <CardHeader>
        <div className='flex justify-between items-center'>
          <div>
            <CardTitle>Preguntas y Respuestas</CardTitle>
            <CardDescription>Gestionar Q&A para {documentName}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='grid gap-4'>
            <div>
              <Label htmlFor='question'>Pregunta</Label>
              <Input
                id='question'
                value={newQA.question}
                onChange={(e) =>
                  setNewQA({ ...newQA, question: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor='answer'>Respuesta</Label>
              <Textarea
                id='answer'
                value={newQA.answer}
                onChange={(e) => setNewQA({ ...newQA, answer: e.target.value })}
              />
            </div>
            <Button
              onClick={isEditing ? handleUpdateQA : handleAddQA}
              disabled={!newQA.question || !newQA.answer || isGenerating}>
              {isGenerating ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              ) : isEditing ? (
                <MessageSquare className='w-4 h-4 mr-2' />
              ) : (
                <Plus className='w-4 h-4 mr-2' />
              )}
              {isGenerating
                ? "Procesando..."
                : isEditing
                ? "Actualizar Q&A"
                : "Agregar Q&A"}
            </Button>
          </div>

          <div className='space-y-4'>
            {qaDocs.map((qa, index) => (
              <Card
                key={index}
                className='cursor-pointer hover:bg-foreground/10'
                onClick={() => handleQAClick(qa, index)}>
                <CardHeader className='relative'>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='absolute right-4 top-4'
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDocQa(qa.document_storage_id, qa.vapiFileId, qa.id);
                    }}>
                    {loadingDeleteMap[qa.id] ? (
                      <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                      <>
                        <X className='w-4 h-4' />
                        <span className='sr-only'>Eliminar Q&A</span>
                      </>
                    )}
                  </Button>
                  <CardTitle className='text-base'>
                    <MessageSquare className='w-4 h-4 inline-block mr-2' />
                    {qa.question}
                  </CardTitle>
                  <CardDescription>{qa.answer}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
