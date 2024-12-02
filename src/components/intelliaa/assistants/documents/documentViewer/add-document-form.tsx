"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AddDocumentFormProps {
  onAddDocument: (file: File) => void;
}

export function AddDocumentForm({ onAddDocument }: AddDocumentFormProps) {
  const [open, setOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddDocument(file);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className='w-4 h-4 mr-2' />
          Agregar nuevo documento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar nuevo archivo</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4'>
          <Label htmlFor='file'>Archivo PDF</Label>
          <Input
            id='file'
            type='file'
            accept='.pdf'
            onChange={handleFileChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
