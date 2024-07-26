import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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

import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { deleteAssistant } from "@/lib/actions/intelliaa/assistants";
import { useState } from "react";

export function ModalDeleteAssistant({
  id_assistant,
  namespace,
  service_id_rw,
}: {
  id_assistant: string;
  namespace: string;
  service_id_rw: string;
}) {
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDeleteAssistant = async () => {
    const account = await getAccount();
    const account_id = account.account_id;
    setLoadingDelete(true);
    await deleteAssistant(id_assistant, namespace, service_id_rw, account_id);
    setLoadingDelete(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='icon'>
          <Trash2 size={17} className='text-red-500' />
        </Button>
      </DialogTrigger>
      <DialogContent
        className='sm:max-w-md'
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}>
        <DialogHeader>
          <DialogTitle>Borrar Asistente</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas borrar este asistente?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='sm:justify-start'>
          <div>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleDeleteAssistant()}
              className='text-red-500'>
              {loadingDelete ? (
                <Loader2 size={17} className='animate-spin text-red-500' />
              ) : (
                "Borrar"
              )}
            </Button>
          </div>
          <div>
            <DialogClose asChild>
              <Button type='button' variant='secondary'>
                Cancelar
              </Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
