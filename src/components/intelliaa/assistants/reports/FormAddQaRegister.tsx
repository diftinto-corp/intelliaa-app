"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { upsertQa } from "@/lib/actions/intelliaa/qa";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";

export default function FormAddQaRegisterComponent({
  register,
  assistant,
  lastChat,
}: {
  register: any;
  assistant: any;
  lastChat: any;
}) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const [question, setQuestion] = useState(register?.question || "");
  const [answer, setAnswer] = useState(register?.answer || "");
  const [loading, setLoading] = useState(false);
  const [account_id, setAccount_id] = useState<string>("" as string);

  useEffect(() => {
    const getAccountId = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      setAccount_id(team_account.account_id as string);
    };

    getAccountId();
  }, []);

  useEffect(() => {
    setQuestion(register?.question || "");
    setAnswer(register?.answer || "");
  }, [register]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const id_document = Math.random().toString(36).substring(2, 15);
    try {
      const upsert = await upsertQa(
        question,
        assistant.namespace,
        id_document,
        answer
      );

      const supabase = createClient();
      const { error } = await supabase.from("qa_docs").insert([
        {
          account_id,
          assistant_id: assistant.id,
          question,
          answer,
          namespace: assistant.namespace,
          id_document,
        },
      ]);

      if (error) {
        console.log("Error al insertar la pregunta y respuesta:", error);
        return {
          message: error.message,
        };
      }

      setLoading(false);
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-foreground'
      onSubmit={handleSubmit}>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='question' className='text-muted-foreground'>
          Pregunta
        </Label>
        <Input
          className='text-muted-foreground'
          name='question'
          placeholder='Aqui va tu pregunta'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
      </div>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='answer' className='text-muted-foreground'>
          Respuesta
        </Label>
        <Textarea
          className='text-muted-foreground'
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
        {loading ? <Loader2 size={17} className=' animate-spin' /> : "Guardar"}
      </Button>
    </form>
  );
}
