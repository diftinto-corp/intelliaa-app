"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  MessageSquare,
  X,
  Download,
  Loader2,
  Pencil,
} from "lucide-react";
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
import {
  getAllQa,
  uploadTxt,
  updateQa,
  deleteQa,
} from "@/lib/actions/intelliaa/qa";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { vapiService } from "@/services/vapiService";
import { QAItem } from "@/interfaces/intelliaa";

interface QA {
  question: string;
  answer: string;
}

interface QASectionProps {
  account_id: string;
  documentStorageId: string;
  documentName: string;
  filename: string;
  documentStorageNamespace: string;
}

export function QASection({
  account_id,
  documentStorageId,
  documentName,
  filename,
  documentStorageNamespace,
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
        formData,
        documentStorageNamespace
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
      await deleteQa(
        documentStorageId,
        qaToUpdate.vapiFileId,
        qaToUpdate.id,
        documentStorageNamespace
      );

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
        formData,
        documentStorageNamespace
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
  const deleteDocQa = async (
    documentStorageId: string,
    id_vapi_doc: string,
    id: string
  ) => {
    try {
      setLoadingDeleteMap((prev) => ({ ...prev, [id]: true }));
      await deleteQa(
        documentStorageId,
        id_vapi_doc,
        id,
        documentStorageNamespace
      );
    } finally {
      setLoadingDeleteMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <Card className='h-[calc(100vh-200px)] flex flex-col text-muted-foreground'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <div>
          <CardTitle>Texto Complementario</CardTitle>
          <CardDescription>Gestionar texto complementario</CardDescription>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant='default' size='sm'>
              <Plus className='w-4 h-4 mr-2' />
              Agregar nuevo Texto Complementario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className='text-muted-foreground'>
                Agregar nuevo Texto Complementario
              </DialogTitle>
            </DialogHeader>
            <div className='grid gap-4 py-4 text-muted-foreground'>
              <div className='grid gap-2'>
                <Label htmlFor='question'>Título</Label>
                <Input
                  id='question'
                  value={newQA.question}
                  onChange={(e) =>
                    setNewQA({ ...newQA, question: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='answer'>Texto Complementario</Label>
                <Textarea
                  id='answer'
                  value={newQA.answer}
                  onChange={(e) =>
                    setNewQA({ ...newQA, answer: e.target.value })
                  }
                />
              </div>
            </div>
            <Button
              onClick={handleAddQA}
              disabled={!newQA.question || !newQA.answer}>
              Agregar Texto Complementario
            </Button>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className='flex-grow overflow-hidden'>
        <ScrollArea className='h-full'>
          <Accordion type='single' collapsible className='w-full'>
            {qaDocs.map((qa) => (
              <AccordionItem key={qa.id} value={qa.id}>
                <AccordionTrigger>{qa.question}</AccordionTrigger>
                <AccordionContent>
                  <p className='mb-4'>{qa.answer}</p>
                  <div className='flex justify-end space-x-2'>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant='default' size='sm'>
                          <Pencil className='w-4 h-4 mr-2' />
                          Editar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className='text-muted-foreground'>
                        <DialogHeader>
                          <DialogTitle>Editar Q&A</DialogTitle>
                        </DialogHeader>
                        <div className='grid gap-4 py-4'>
                          <div className='grid gap-2'>
                            <Label htmlFor='edit-question'>Pregunta</Label>
                            <Input
                              id='edit-question'
                              value={newQA.question || qa.question}
                              onChange={(e) =>
                                setNewQA({
                                  ...newQA,
                                  question: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className='grid gap-2'>
                            <Label htmlFor='edit-answer'>Respuesta</Label>
                            <Textarea
                              id='edit-answer'
                              value={newQA.answer || qa.answer}
                              onChange={(e) =>
                                setNewQA({ ...newQA, answer: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <Button onClick={handleUpdateQA}>Actualizar Q&A</Button>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() =>
                        deleteDocQa(documentStorageId, qa.vapiFileId, qa.id)
                      }>
                      <X className='w-4 h-4 mr-2' />
                      Eliminar
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
