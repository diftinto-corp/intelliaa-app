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
import TabAssistantVoice from "../voice/TabAssistantVoice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";

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
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];

  const [assistant, setAssistant] = useState<any>(
    assistantsListPage[0] ? assistantsListPage[0] : {}
  );

  const [templateName, setTemplateName] = useState<string>("");

  useEffect(() => {
    const fetchAssistants = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const account_id = team_account.account_id;
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
        <div className='flex flex-col  bg-background w-[15%] border rounded p-2'>
          <div className='flex flex-col'>
            <ModalAdd templates={templates} />
          </div>
          <p className='text-left text-xl font-semibold  text-muted-foreground  my-4'>
            Asistentes:{" "}
          </p>
          <ScrollArea className='flex flex-col gap-2'>
            {assistantsListPage.map((assistant) => (
              <div
                key={assistant.id}
                className={`flex items-center gap-4 justify-between rounded-sm px-3 py-2 mb-2 border bg-[#242322]/80 border-gray-700 shadow-[inset_0_0_20px_rgba(20,184,166,0.2)] overflow-hidden hover:bg-teal-900 text-sm text-muted-foreground font-semibold hover:text-primary cursor-pointer ${
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
          </ScrollArea>
        </div>
        {/* Renderizado condicional según el tipo de asistente */}
        <div className='flex flex-col bg-background w-[85%] border rounded p-2'>
          {(() => {
            switch (assistantSelected.type_assistant) {
              case "whatsapp":
                return (
                  <div className='flex flex-col'>
                    <div className='flex w-full justify-between px-4'>
                      <div>
                        <p className='text-left bg-gradient-to-r from-[#14b8a6] to-[#14b8a6]/40 bg-clip-text text-transparent text-xl font-semibold my-4'>
                          {assistant?.name}
                        </p>
                      </div>
                      <div>
                        <p className='text-left text-xl font-semibold bg-gradient-to-r from-[#14b8a6] to-[#14b8a6]/40 bg-clip-text text-transparent my-4 '>
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
                );
              case "voice":
                return (
                  <div className='flex flex-col'>
                    <div className='flex w-full justify-between px-4'>
                      <div>
                        <p className='text-left bg-gradient-to-r from-[#14b8a6] to-[#14b8a6]/40 bg-clip-text text-transparent text-xl font-semibold my-4'>
                          {assistant?.name}
                        </p>
                      </div>
                      <div>
                        <p className='text-left text-xl font-semibold bg-gradient-to-r from-[#14b8a6] to-[#14b8a6]/40 bg-clip-text text-transparent my-4 '>
                          {templateName}
                        </p>
                      </div>
                    </div>
                    <TabAssistantVoice
                      assistant={assistantSelected}
                      setAssistant={setAssistantSelected}
                      qaList={qaList}
                      setQaList={setQaList}
                    />
                  </div>
                );
              case "web":
                return (
                  <div className='flex flex-col justify-center items-center'>
                    <p className='text-center text-primary text-xl font-semibold my-4'>
                      Mensaje del asistente: {assistantSelected.name}
                    </p>
                  </div>
                );
              default:
                return null;
            }
          })()}
        </div>
      </div>
    </div>
  );
}
