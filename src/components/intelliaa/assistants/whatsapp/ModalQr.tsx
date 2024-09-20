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
          <DialogTitle className='font-semibold text-2xl bg-gradient-to-r from-[#14b8a6] to-[#14b8a6]/40 bg-clip-text text-transparent'>
            Escanea el código QR
          </DialogTitle>
          <DialogDescription>
            Por favor, escanea el código QR para conectar a WhatsApp
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
