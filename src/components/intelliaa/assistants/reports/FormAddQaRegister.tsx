"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { uploadTxt, upsertQa } from "@/lib/actions/intelliaa/qa";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { getDocumentStorageByAssistantId } from "@/lib/actions/intelliaa/documents";

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
  const [documentStorageId, setDocumentStorageId] = useState<string>("");

  console.log(question);
  console.log(answer);

  console.log(documentStorageId);

  useEffect(() => {
    const getAccountId = async () => {
      console.log(assistant.id);
      const team_account = await getAccountBySlug(null, accountSlug);
      setAccount_id(team_account.account_id as string);
    };

    getAccountId();
  }, []);

  useEffect(() => {
    const getDocumentStorageId = async () => {
      const documentStorage = await getDocumentStorageByAssistantId(
        assistant?.id
      );
      if (documentStorage && documentStorage.length > 0) {
        setDocumentStorageId(documentStorage[0].document_storage);
      }
    };

    getDocumentStorageId();
    setQuestion(register?.question || "");
    setAnswer(register?.answer || "");
  }, [register]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const filename = `complementary_${Math.random()
        .toString(36)
        .substring(2, 15)}`;

      let content = "PREGUNTAS Y RESPUESTAS\n\n";
      content += `${question}\n`;
      content += `${answer}\n\n`;

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const file = new File([blob], `${filename}.txt`, { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadTxt(
        account_id,
        documentStorageId,
        question,
        answer,
        formData,
        assistant.namespace
      );

      if (result.status === "error") {
        throw new Error(result.message);
      }

      setQuestion("");
      setAnswer("");
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
