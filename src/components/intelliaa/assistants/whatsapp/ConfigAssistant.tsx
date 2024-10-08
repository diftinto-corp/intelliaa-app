"use client";

import { Assistant } from "@/interfaces/intelliaa";
import ModalAdd from "@/components/intelliaa/assistants/ModalAdd";
import { FaWhatsapp } from "react-icons/fa";
import { BotMessageSquare, PhoneCall } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import TabAssistant from "./TabAssistant";
import { getTemplate } from "@/lib/actions/intelliaa/assistants";

export default function ConfigAssistant({
  templates,
  assistantsListPage,
  assistantSelected,
  setAssistantSelected,
  qaList,
  setQaList,
}: {
  templates: any;
  assistantsListPage: Assistant[];
  assistantSelected: Assistant;
  setAssistantSelected: any;
  qaList: [];
  setQaList: any;
}) {
  const [assistant, setAssistant] = useState<any>(
    assistantsListPage[0] ? assistantsListPage[0] : {}
  );

  const [templateName, setTemplateName] = useState<string>("");

  useEffect(() => {
    const fetchAssistants = async () => {
      const account = await getAccount();
      const account_id = account.account_id;
      const supabase = createClient();

      const { data, error } = await supabase
        .from("assistants")
        .select("*")
        .eq("account_id", account_id)
        .eq("id", assistantSelected);

      if (error) {
        return {
          message: error.message,
        };
      }
      setAssistant(data[0]);
    };

    const fetchTemplate = async () => {
      const data = await getTemplate(assistant?.template_id);
      if (!data) return;
      setTemplateName(data.name);
    };

    fetchAssistants();
    fetchTemplate();
  }, [assistantSelected, assistant?.template_id]);

  return (
    <div className='flex flex-col h-[92vh] items-center p-6'>
      <div className='flex w-full h-full gap-4'>
        <div className='flex flex-col bg-background w-[15%] border rounded p-2'>
          <div className='flex flex-col'>
            <ModalAdd templates={templates} />
          </div>
          <p className='text-left text-xl font-semibold  text-muted-foreground  my-4'>
            Asistentes:{" "}
          </p>
          <div className='flex flex-col gap-2'>
            {assistantsListPage.map((assistant) => (
              <div
                key={assistant.id}
                className={`flex items-center gap-4 justify-between rounded-sm px-3 py-2 border hover:bg-teal-900 text-sm text-muted-foreground font-semibold hover:text-primary cursor-pointer ${
                  assistantSelected?.id === assistant.id
                    ? "bg-teal-900 text-primary"
                    : ""
                }`}
                onClick={() => setAssistantSelected(assistant.id)}>
                <p>{assistant.name}</p>
                {assistant.type_assistant === "whatsapp" ? (
                  <FaWhatsapp className='text-2xl font-semibold  ' />
                ) : assistant.type_assistant === "voice" ? (
                  <PhoneCall />
                ) : (
                  <BotMessageSquare />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className='flex flex-col bg-background w-[85%] border rounded p-2'>
          <div className='flex flex-col'>
            <div className='flex w-full justify-between px-4'>
              <div>
                <p className='text-left text-primary text-xl font-semibold  my-4'>
                  {assistant?.name}
                </p>
              </div>
              <div>
                <p className='text-left text-xl font-semibold text-primary my-4 '>
                  {templateName}
                </p>
              </div>
            </div>
            <TabAssistant
              assistant={assistantSelected}
              setAssistant={setAssistantSelected}
              qaList={qaList}
              setQaList={setQaList}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
