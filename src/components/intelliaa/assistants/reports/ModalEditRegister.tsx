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
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useEffect, useState } from "react";
import ChatHistory from "./ChatHistory";
import { GetAssistant } from "@/lib/actions/intelliaa/assistants";
import { useAccounts } from "@usebasejump/next";
import FormAddQaRegisterComponent from "./FormAddQaRegister";

interface ModalEditRegisterProps {
  setOpenModal: (open: boolean) => void;
  register: any;
}

const ModalEditRegister: React.FC<ModalEditRegisterProps> = ({
  setOpenModal,
  register,
}) => {
  const chatHistory = register.chat_history;
  const lastChat =
    chatHistory && chatHistory.length > 0
      ? chatHistory[chatHistory.length - 1]
      : null;
  const [open, setOpen] = useState(false);
  const [registerSelected, setRegisterSelected] = useState(lastChat);
  const [assistant, setAssistant] = useState<any>({});

  const { data } = useAccounts();
  const account_id = data?.[1]?.account_id ?? "";

  useEffect(() => {
    const getAssistant = async () => {
      const assistant = await GetAssistant(account_id, register.assistant_id);
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
          <DialogTitle>Editar Pregunta y Respuesta</DialogTitle>
          <DialogDescription>
            Por favor, complete el formulario a continuación para editar la
            Pregunta y Respuesta.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-row'>
          <div className='w-1/2'>
            <div className='text-sm font-semibold text-gray-500'>Pregunta</div>
            <div className='text-lg font-semibold'>{register.answers}</div>
          </div>
          <div className='w-1/2'>
            <div className='text-sm font-semibold text-gray-500'>Respuesta</div>
            <div className='text-lg font-semibold text-red-500'>
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
