"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import Image from "next/image";
import { FaWhatsapp } from "react-icons/fa";
import { BotMessageSquare, Loader2, PhoneCall } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NewAssistant } from "@/lib/actions/intelliaa/assistants";

import { useAccounts } from "@usebasejump/next";
import { AssistantTemplate } from "@/interfaces/intelliaa";

export default function FormAddComponent({
  dataTemplates,
  setOpenModal,
}: {
  dataTemplates: {
    templates: AssistantTemplate[];
  };
  setOpenModal: any;
}) {
  const [nameAssistant, setNameAssistant] = useState<string>("");
  const [templateSelected, setTemplateSelected] = useState<AssistantTemplate>(
    dataTemplates.templates[0]
  );
  const [typeSelected, setTypeSelected] = useState<string>("whatsapp");
  const { data } = useAccounts();
  const account_id = data?.[1]?.account_id ?? "";
  const [loading, setLoading] = useState(false);

  const { templates } = dataTemplates;

  let formData = new FormData();

  const handleChange = (e: any) => {
    setNameAssistant(e.target.value);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const name = nameAssistant;
    const type = typeSelected;
    const template = templateSelected;

    formData.append("name", name);
    setLoading(true);
    try {
      if (type === "whatsapp") {
        await NewAssistant(
          account_id,
          name,
          type,
          template.id,
          template.prompt,
          template.temperature,
          template.tokens
        );
      }
      if (type === "voice") {
        try {
          const res = await fetch("/api/create-assistant-voice", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              account_id,
              name,
              type,
              template_id: template.id,
              prompt: template.prompt,
              temperature: template.temperature,
              tokens: template.tokens,
              firstMessage: "Hola, ¿En que te puedo ayudar?",
            }),
          });

          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          const data = await res.json();
          console.log("Assistant created in VAPI:", data);
        } catch (error) {
          console.error("Error creating assistant voice:", error);
        } finally {
          setLoading(false);
        }
      }

      setLoading(false);
      setOpenModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <form
      className='animate-in flex-1 flex flex-col w-full justify-center gap-y-6 text-foreground'
      onSubmit={handleSubmit}>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='email' className='text-muted-foreground'>
          Nombre de asistente
        </Label>
        <Input
          name='name'
          placeholder='Mi asistente'
          onChange={handleChange}
          required
          className='text-muted-foreground'
        />
      </div>

      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='email' className='text-muted-foreground'>
          Plantillas de asistentes
        </Label>

        <div className='flex gap-2 flex-wrap justify-between '>
          {templates?.map((assistant) => {
            return (
              <div
                key={assistant.id}
                className='flex justify-start items-center flex-col gap-y-2 max-w-[80px] max-h-[150px] cursor-pointer'>
                <div
                  className={`w-[80px] h-[80px]  rounded
                  ${
                    templateSelected?.id === assistant.id
                      ? "border-primary border-4 "
                      : "border-transparent border-4 "
                  }  
                    `}
                  onClick={() => setTemplateSelected(assistant)}>
                  <Image
                    className='rounded'
                    src={assistant.image_url}
                    alt={assistant.name}
                    width={80}
                    height={80}
                  />
                </div>
                <span className='text-xs text-center text-muted-foreground'>
                  {assistant.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='email' className='text-muted-foreground'>
          Tipos de asistentes
        </Label>

        <div className='flex gap-4 flex-wrap '>
          <div className='flex flex-col'>
            <div
              className={`flex justify-center items-center w-[80px] h-[80px] bg-background rounded cursor-pointer
            ${
              typeSelected === "whatsapp"
                ? "border-primary border-4 "
                : "border-transparent border-4 "
            }`}
              onClick={() => setTypeSelected("whatsapp")}>
              <FaWhatsapp className='w-[60px] h-[60px] text-primary' />
            </div>
            <span className='text-xs text-center text-muted-foreground'>
              Whatsapp
            </span>
          </div>

          <div className='flex flex-col'>
            <div
              className={` flex justify-center items-center w-[80px] h-[80px]  bg-background rounded cursor-pointer
            
            ${
              typeSelected === "voice"
                ? "border-primary border-4 "
                : "border-transparent border-4 "
            }	

            `}
              onClick={() => setTypeSelected("voice")}>
              <PhoneCall width={60} height={60} className='text-primary' />
            </div>
            <span className='text-xs text-center text-muted-foreground'>
              Voz
            </span>
          </div>
          <div className='flex flex-col'>
            <div
              className={`flex justify-center items-center w-[80px] h-[80px] bg-background rounded
            
            ${
              typeSelected === "web"
                ? "border-primary border-4 "
                : "border-transparent border-4 "
            }
            `}
              // onClick={() => setTypeSelected("web")}
            >
              <BotMessageSquare
                width={60}
                height={60}
                className='text-slate-400'
              />
            </div>
            <span className='text-xs text-center text-muted-foreground'>
              Web Pronto...
            </span>
          </div>
        </div>
      </div>
      <Button
        type='submit'
        disabled={nameAssistant === "" || loading ? true : false}>
        {loading ? <Loader2 className=' animate-spin' /> : "Crear asistente"}
      </Button>
    </form>
  );
}
