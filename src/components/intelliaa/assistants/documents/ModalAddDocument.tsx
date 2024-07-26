"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useState } from "react";
import FormAddDocComponent from "./FormAddDoc";

export default function ModalAddDocument() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' className='mt-4'>
          <Plus className='h-4 w-4 mr-2' />
          Agregar nuevo documento
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
          <DialogTitle>Agregar nuevo documento</DialogTitle>
          <DialogDescription>
            Por favor complete el siguiente formulario para agregar un nuevo
            documento
          </DialogDescription>
        </DialogHeader>
        <FormAddDocComponent setOpenModal={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
