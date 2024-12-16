"use client";

import { useEffect, useState } from "react";
import { Plus, X, Loader2, Pencil, Check } from "lucide-react";
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
  DialogClose,
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
import { useToast } from "@/lib/hooks/use-toast";

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
  const { toast } = useToast();
  const [newQA, setNewQA] = useState<QA>({ question: "", answer: "" });
  const [qaDocs, setQaDocs] = useState<QAItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedQAIndex, setSelectedQAIndex] = useState<number | null>(null);
  const [loadingDeleteMap, setLoadingDeleteMap] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

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
      setIsLoading(true);

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
      toast({
        title: "Error",
        description: "Error al agregar Q&A y generar documento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setOpen(false);
      toast({
        title: "Q&A agregado",
        description: "Q&A agregado correctamente",
        variant: "default",
      });
    }
  };

  const deleteDocQa = async (
    documentStorageId: string,
    id_vapi_doc: string,
    id: string
  ) => {
    try {
      setIsLoading(true);
      setLoadingDeleteMap((prev) => ({ ...prev, [id]: true }));
      await deleteQa(
        documentStorageId,
        id_vapi_doc,
        id,
        documentStorageNamespace
      );
    } catch (error) {
      console.error("Error al eliminar Q&A:", error);
      toast({
        title: "Error",
        description: "Error al eliminar Q&A",
        variant: "destructive",
      });
    } finally {
      setLoadingDeleteMap((prev) => ({ ...prev, [id]: false }));
      setIsLoading(false);
      toast({
        title: "Q&A eliminado",
        description: "Q&A eliminado correctamente",
        variant: "default",
      });
    }
  };

  return (
    <Card className='h-[calc(100vh-200px)] flex flex-col text-muted-foreground'>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <div>
          <CardTitle>Texto Complementario</CardTitle>
          <CardDescription>Gestionar texto complementario</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant='default' size='sm' disabled={isLoading}>
              <Plus className='w-4 h-4 mr-2' />
              Agregar nuevo Texto Complementario
            </Button>
          </DialogTrigger>
          <DialogContent
            onInteractOutside={(e) => {
              e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
            }}>
            <DialogHeader>
              <DialogTitle className='text-muted-foreground'>
                Agregar nuevo Texto Complementario
              </DialogTitle>
            </DialogHeader>
            <DialogClose className='absolute right-4 top-4 rounded-sm  ring-offset-background transition-opacity  focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground'>
              <X className='h-4 w-4 text-red-500' />
              <span className='sr-only'>Cerrar</span>
            </DialogClose>
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
              disabled={!newQA.question || !newQA.answer || isLoading}>
              {isLoading ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              ) : (
                <Plus className='w-4 h-4 mr-2' />
              )}
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
                    <Button
                      variant='destructive'
                      size='sm'
                      disabled={loadingDeleteMap[qa.id]}
                      onClick={() =>
                        deleteDocQa(documentStorageId, qa.vapiFileId, qa.id)
                      }>
                      {loadingDeleteMap[qa.id] ? (
                        <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                      ) : (
                        <X className='w-4 h-4 mr-2' />
                      )}
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
