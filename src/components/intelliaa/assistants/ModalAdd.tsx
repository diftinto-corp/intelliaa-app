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
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import FormAddComponent from "@/components/intelliaa/assistants/FormAdd";
import { useState } from "react";

export default function ModalAdd(templates: any) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' className='mt-4'>
          <Plus className='h-4 w-4 mr-2' />
          Agregar nuevo Asistente
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
            Agregar nuevo Asistente
          </DialogTitle>
          <DialogDescription>
            Agrega un nuevo asistente para tu cuenta
          </DialogDescription>
        </DialogHeader>
        <DialogClose className="absolute right-4 top-4 rounded-sm  ring-offset-background transition-opacity  focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4 text-red-600" />
          <span className="sr-only">Cerrar</span>
        </DialogClose>
        <FormAddComponent dataTemplates={templates} setOpenModal={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
