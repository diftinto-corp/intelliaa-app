"use client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useEffect, useState } from "react";
import ChatHistory from "./ChatHistory";
import { GetAssistant } from "@/lib/actions/intelliaa/assistants";
import FormAddQaRegisterComponent from "./FormAddQaRegister";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";

interface ModalEditRegisterProps {
  setOpenModal: (open: boolean) => void;
  register: any;
}

const ModalEditRegister: React.FC<ModalEditRegisterProps> = ({
  setOpenModal,
  register,
}) => {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const chatHistory = register.chat_history;
  const lastChat =
    chatHistory && chatHistory.length > 0
      ? chatHistory[chatHistory.length - 1]
      : null;
  const [open, setOpen] = useState(false);
  const [registerSelected, setRegisterSelected] = useState(lastChat);
  const [assistant, setAssistant] = useState<any>({});

  useEffect(() => {
    const getAssistant = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const assistant = await GetAssistant(
        team_account.account_id,
        register.assistant_id
      );
      setAssistant(assistant);
    };
    getAssistant();
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='icon' onClick={() => setOpen(true)}>
          <Edit size={17} className='text-primary' />
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle className='text-muted-foreground'>
            Editar Pregunta y Respuesta
          </DialogTitle>
          <DialogDescription>
            Por favor, complete el formulario a continuación para editar la
            Pregunta y Respuesta.
          </DialogDescription>
        </DialogHeader>
        <DialogClose className="absolute right-4 top-4 rounded-sm  ring-offset-background transition-opacity  focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4 text-red-600" />
          <span className="sr-only">Cerrar</span>
        </DialogClose>
        <div className='flex flex-row'>
          <div className='w-1/2'>
            <div className='text-sm font-semibold text-gray-500'>Pregunta</div>
            <div className='text-lg text-muted-foreground font-semibold'>
              {register.answers}
            </div>
          </div>
          <div className='w-1/2'>
            <div className='text-sm font-semibold text-gray-500'>Respuesta</div>
            <div className='text-lg text-muted-foreground font-semibold text-red-500'>
              {register.wrong_answers}
            </div>
          </div>
        </div>
        <FormAddQaRegisterComponent
          register={registerSelected}
          assistant={assistant}
          lastChat={lastChat}
        />
        <ChatHistory
          chatHistory={register.chat_history}
          setRegisterSelected={setRegisterSelected}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ModalEditRegister;
