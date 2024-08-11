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
import { Edit, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useEffect, useState } from "react";

import { Assistant } from "@/interfaces/intelliaa";
import { GetAllAssistants } from "@/lib/actions/intelliaa/assistants";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { FormAssignAssistantToNumber } from "./FormAssignAssistantToNumber";

interface ActiveNumber {
  number: string;
  country: string;
  type: string;
  id_assistant: string;
  name_assistant: string;
  id_number_vapi: string;
}

export default function ModalAssignAssistantToNumber({
  number,
}: {
  number: ActiveNumber;
}) {
  const [open, setOpen] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);

  useEffect(() => {
    const getAssistants = async () => {
      try {
        const account = await getAccount();
        const account_id = account.account_id;

        const result = await GetAllAssistants(account_id);

        console.log("Assistants:", result);

        if (Array.isArray(result)) {
          // Filtrar asistentes donde active_number es null
          const filteredAssistants = result.filter(
            (assistant: { active_number: false }) =>
              assistant.active_number === false
          );

          setAssistants(filteredAssistants);
        } else {
          console.error(result.message);
        }
      } catch (error) {
        console.error("Error fetching assistants:", error);
      }
    };

    // Llamar a la función para obtener y filtrar asistentes
    getAssistants();
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {number?.id_assistant ? (
          <Button size='sm' className='mt-4'>
            <Edit className='h-4 w-4 mr-2' />
            {number.name_assistant}
          </Button>
        ) : (
          <Button size='sm' className='mt-4'>
            <Plus className='h-4 w-4 mr-2' />
            Asignar asistente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className='sm:max-w-[600px]'
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}>
        <DialogHeader>
          <DialogTitle className='text-muted-foreground'>
            Asignar asistente para llamadas entrantes
          </DialogTitle>
          <DialogDescription>
            Por favor, seleccione el asistente que deseas que atienda las
            llamadas a este número.
          </DialogDescription>
          <FormAssignAssistantToNumber
            number={number}
            assistants={assistants}
            setOpen={setOpen}
          />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
