"use client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit, Edit2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useState } from "react";
import FormAddQaComponent from "./FormAddQa";
import { Assistant } from "@/interfaces/intelliaa";
import FormEditQaComponent from "./FormEditQa";
import { set } from "date-fns";

export default function ModalEditQa({
  qa,
  setOpenModal,
  assistant,
}: {
  qa: any;
  setOpenModal: any;
  assistant: Assistant;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='icon' onClick={() => setOpen(true)}>
          <Edit size={17} className='text-primary' />
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
          <DialogTitle className='font-semibold text-2xl bg-gradient-to-r from-[#14b8a6] to-[#14b8a6]/40 bg-clip-text text-transparent'>
            Editar Pregunta & Respuesta
          </DialogTitle>
          <DialogDescription>
            Por favor, complete el formulario a continuación para editar la
            Pregunta y Respuesta.
          </DialogDescription>
        </DialogHeader>
        <DialogClose className="absolute right-4 top-4 rounded-sm  ring-offset-background transition-opacity  focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4 text-red-600" />
          <span className="sr-only">Cerrar</span>
        </DialogClose>
        <FormEditQaComponent
          qa={qa}
          setOpenModal={setOpen}
          assistant={assistant}
        />
      </DialogContent>
    </Dialog>
  );
}
