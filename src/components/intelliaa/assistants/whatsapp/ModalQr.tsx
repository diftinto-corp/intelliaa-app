"use client";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { useEffect, useState } from "react";

import { Assistant } from "@/interfaces/intelliaa";
import { Scan } from "lucide-react";
import { revalidatePath } from "next/cache";

export default function ModalQr({
  setOpenModal,
  assistant,
}: {
  setOpenModal: any;
  assistant: Assistant;
}) {
  const [open, setOpen] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(Date.now());
    }, 60000); // Cambia el tiempo según tus necesidades

    return () => clearInterval(interval);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Scan size={17} className='mr-2' />
          Scan QR
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
            Scan the QR code
          </DialogTitle>
          <DialogDescription>
            Please scan the QR code to connect to WhatsApp
          </DialogDescription>
          <div className='flex flex-col'>
            <div className='flex justify-center'>
              <Image
                src={`${assistant.qr_url}?timestamp=${timestamp}`}
                width={200}
                height={200}
                alt={"qr"}
              />
            </div>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
