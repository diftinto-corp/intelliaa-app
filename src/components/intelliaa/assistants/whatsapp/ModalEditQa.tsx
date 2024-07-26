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
import { Edit, Edit2, Plus } from "lucide-react";
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
          <DialogTitle className='text-muted-foreground'>
            Editar Pregunta & Respuesta
          </DialogTitle>
          <DialogDescription>
            Por favor, complete el formulario a continuación para editar la
            Pregunta y Respuesta.
          </DialogDescription>
        </DialogHeader>
        <FormEditQaComponent
          qa={qa}
          setOpenModal={setOpen}
          assistant={assistant}
        />
      </DialogContent>
    </Dialog>
  );
}
