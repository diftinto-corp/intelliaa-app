"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useState } from "react";
import FormDeleteDocComponent from "./FormDeleteDoc";

export default function ModalDeleteDocument({
  account_id,
  key,
  id,
}: {
  account_id: string;
  key: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          className='  text-red-600 hover:bg-red-50 hover:text-red-500 self-end '>
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Delete document {key}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this document?
          </DialogDescription>
        </DialogHeader>
        <FormDeleteDocComponent
          setOpenModal={setOpen}
          account_id={account_id}
          key={key}
          id={id}
        />
      </DialogContent>
    </Dialog>
  );
}
