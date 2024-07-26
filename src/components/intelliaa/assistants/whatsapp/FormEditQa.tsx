"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTeam } from "@/lib/actions/teams";
import Image from "next/image";
import { FaWhatsapp } from "react-icons/fa";
import { BotMessageSquare, Loader2, PhoneCall } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  NewAssistant,
  AssistantsTemplateList,
} from "@/lib/actions/intelliaa/assistants";
import { usePersonalAccount } from "@usebasejump/next";
import { useAccounts } from "@usebasejump/next";
import { Textarea } from "@/components/ui/textarea";
import { Assistant } from "@/interfaces/intelliaa";
import { add } from "date-fns";
import {
  addQa,
  deleteDocuments,
  updateQa,
  upsertQa,
} from "@/lib/actions/intelliaa/qa";

export default function FormEditQaComponent({
  qa,
  setOpenModal,
  assistant,
}: {
  qa: any;
  setOpenModal: any;
  assistant: Assistant;
}) {
  const { data } = useAccounts();
  const account_id = data?.[1]?.account_id ?? "";

  const [question, setQuestion] = useState(qa.question);
  const [answer, setAnswer] = useState(qa.answer);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    await deleteDocuments(qa.id_document, qa.namespace);

    await upsertQa(answer, qa.namespace, qa.id_document, question);

    await updateQa(account_id, question, answer, qa.id);

    setLoading(false);
    setOpenModal(false);
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-foreground'
      onSubmit={handleSubmit}>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='question'>Pregunta</Label>
        <Input
          name='question'
          placeholder='Aqui va tu pregunta'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
      </div>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='answare'>Respuesta</Label>
        <Textarea
          name='answer'
          placeholder='Aqui va tu respuesta'
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          required
        />
      </div>
      <Button
        type='submit'
        disabled={loading || question === "" || answer === ""}>
        {loading ? <Loader2 size={20} className=' animate-spin' /> : "Guardar"}
      </Button>
    </form>
  );
}
