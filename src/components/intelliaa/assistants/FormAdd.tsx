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
      await NewAssistant(
        account_id,
        name,
        type,
        template.id,
        template.name,
        template.s3_key,
        template.prompt,
        template.temperature,
        template.tokens
      );

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
        <Label htmlFor='email'>Assistant Name</Label>
        <Input
          name='name'
          placeholder='My Assistant'
          onChange={handleChange}
          required
        />
      </div>

      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='email'>Assistant templates</Label>

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
                      ? "border-[#5ECFFF] border-4 "
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
                <span className='text-xs text-center'>{assistant.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className='flex flex-col gap-y-2'>
        <Label htmlFor='email'>Assistant types</Label>

        <div className='flex gap-4 flex-wrap '>
          <div className='flex flex-col'>
            <div
              className={`flex justify-center items-center w-[80px] h-[80px] bg-slate-100 rounded cursor-pointer
            ${
              typeSelected === "whatsapp"
                ? "border-[#5ECFFF] border-4 "
                : "border-transparent border-4 "
            }`}
              onClick={() => setTypeSelected("whatsapp")}>
              <FaWhatsapp className='w-[60px] h-[60px] text-primary' />
            </div>
            <span className='text-xs text-center'>Whatsapp</span>
          </div>

          <div className='flex flex-col'>
            <div
              className={` flex justify-center items-center w-[80px] h-[80px]  bg-slate-100 rounded
            
            ${
              typeSelected === "voice"
                ? "border-[#5ECFFF] border-4 "
                : "border-transparent border-4 "
            }	

            `}
              // onClick={() => setTypeSelected("voice")}
            >
              <PhoneCall width={60} height={60} className='text-slate-400' />
            </div>
            <span className='text-xs text-center'>Voice Pronto...</span>
          </div>
          <div className='flex flex-col'>
            <div
              className={`flex justify-center items-center w-[80px] h-[80px] bg-slate-100 rounded
            
            ${
              typeSelected === "web"
                ? "border-[#5ECFFF] border-4 "
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
            <span className='text-xs text-center'>Web Pronto...</span>
          </div>
        </div>
      </div>
      <Button
        type='submit'
        disabled={nameAssistant === "" || loading ? true : false}>
        {loading ? <Loader2 className=' animate-spin' /> : "Create Assistant"}
      </Button>
    </form>
  );
}
