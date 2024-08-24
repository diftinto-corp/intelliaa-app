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
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";

export function ModalDeleteAssistantVoice({
  id_assistant,
  voice_assistant_id,
}: {
  id_assistant: string;
  voice_assistant_id: string;
}) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDeleteAssistant = async () => {
    const team_account = await getAccountBySlug(null, accountSlug);
    const account_id = team_account.account_id;
    setLoadingDelete(true);
    try {
      const res = await fetch("/api/delete-assistant-voice", {
        method: "POST",
        body: JSON.stringify({
          id_assistant,
          voice_assistant_id: voice_assistant_id,
          accountId: account_id,
        }),

        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      console.error("Internal Server Error:", e);
    } finally {
      setLoadingDelete(false);
      setOpen(false);
    }
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
          <DialogTitle className='text-muted-foreground'>
            Borrar Asistente
          </DialogTitle>
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
