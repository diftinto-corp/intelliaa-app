"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useState } from "react";
import FormAddQaComponent from "./FormAddQa";
import { Assistant } from "@/interfaces/intelliaa";

export default function ModalAddQa({ assistant }: { assistant: Assistant }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' className='mt-4'>
          <Plus className='h-4 w-4 mr-2' />
          Agregar nueva Pregunta & Respuesta
        </Button>
      </DialogTrigger>
      <DialogContent
        className='sm:max-w-[425px]'
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}>
        <DialogHeader>
          <DialogTitle className='text-muted-foreground'>
            Agregar nueva pregunta y respuesta.
          </DialogTitle>
          <DialogDescription>
            Por favor, complete el formulario a continuación para agregar una
            nueva Pregunta y Respuesta.
          </DialogDescription>
        </DialogHeader>
        <FormAddQaComponent setOpenModal={setOpen} assistant={assistant} />
      </DialogContent>
    </Dialog>
  );
}
