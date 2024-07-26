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
          <DialogTitle className='text-muted-foreground'>
            Agregar nuevo Asistente
          </DialogTitle>
          <DialogDescription>
            Agrega un nuevo asistente para tu cuenta
          </DialogDescription>
        </DialogHeader>
        <FormAddComponent dataTemplates={templates} setOpenModal={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
