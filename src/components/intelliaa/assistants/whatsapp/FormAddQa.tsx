"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@usebasejump/next";
import { Textarea } from "@/components/ui/textarea";
import { Assistant } from "@/interfaces/intelliaa";

import { addQa, upsertQa } from "@/lib/actions/intelliaa/qa";

export default function FormAddQaComponent({
  setOpenModal,
  assistant,
}: {
  setOpenModal: any;
  assistant: Assistant;
}) {
  const { data } = useAccounts();
  const account_id = data?.[1]?.account_id ?? "";
  const [loading, setLoading] = useState(false);

  let formData = new FormData();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    const question = e.target.question.value;
    const answer = e.target.answare.value;
    const id_document = Math.random().toString(36).substring(2, 15);

    formData.append("question", question);
    formData.append("answer", answer);

    const upsert = await upsertQa(
      answer,
      assistant.namespace,
      id_document,
      question
    );
    if (upsert.numAdded === 0) {
      console.log("Error");
      return;
    }
    await addQa(
      account_id,
      assistant.id,
      formData,
      assistant.namespace,
      id_document
    );

    setOpenModal(false);
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-mute-foreground'
      onSubmit={handleSubmit}>
      <div className='flex flex-col gap-y-2 text-mute-foreground'>
        <Label htmlFor='question' className='text-muted-foreground'>
          Pregunta
        </Label>
        <Input
          className='text-muted-foreground'
          name='question'
          placeholder='Aqui va tu pregunta'
          required
        />
      </div>
      <div className='flex flex-col gap-y-2 text-mute-foreground'>
        <Label htmlFor='answare' className='text-muted-foreground'>
          Respuesta
        </Label>
        <Textarea
          className='text-muted-foreground'
          name='answare'
          placeholder='Aqui va tu respuesta'
          required
        />
      </div>
      <Button type='submit'>
        {loading ? (
          <Loader2 size={20} className=' animate-spin' />
        ) : (
          "Agregar Pregunta y Respuesta"
        )}
      </Button>
    </form>
  );
}
