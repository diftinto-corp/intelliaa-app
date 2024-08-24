"use client";
import { Assistant } from "@/interfaces/intelliaa";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import {
  AssistantsTemplateList,
  GetAllAssistants,
} from "@/lib/actions/intelliaa/assistants";
import { createClient } from "@/lib/supabase/client";
import { use, useEffect, useState } from "react";
import ConfigAssistant from "./whatsapp/ConfigAssistant";
import ModalAdd from "./ModalAdd";
import { Skeleton } from "@/components/ui/skeleton";
import { set } from "date-fns";
import { getAllQa } from "@/lib/actions/intelliaa/qa";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";

export default function AssistantComponent() {
  const pathname = usePathname();
  const path = pathname.split("/")[1];
  const [assistantsList, setAssistantsList] = useState<Assistant[]>([]);
  const [assistantSelected, setAssistantSelected] = useState<Assistant>(
    {} as Assistant
  );
  const [templates, setTemplates] = useState<any>([]);
  const [qaList, setQaList] = useState<any>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const fetchAssistants = async () => {
      const accounbySlugt = await getAccountBySlug(null, path);
      const account_id = accounbySlugt.account_id;
      const newAssistants: any = await GetAllAssistants(account_id);
      if (!newAssistants) return;
      setAssistantsList([...newAssistants]);
      setAssistantSelected(newAssistants[0]);
      setLoading(false);
    };

    const fetchTemplates = async () => {
      const templates = await AssistantsTemplateList();
      if (!templates) return;

      setTemplates(templates);
    };

    fetchAssistants();
    fetchTemplates();
  }, []);

  useEffect(() => {
    const fetchAssistants = async () => {
      const accounbySlugt = await getAccountBySlug(null, path);
      const account_id = accounbySlugt.account_id;

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
      setAssistantSelected(data[0]);
    };

    const fetchQaList = async () => {
      const qalist = await getAllQa(assistantSelected?.id);
      if (!qalist) return;
      setQaList(qalist);
    };

    fetchAssistants();
    fetchQaList();
  }, [assistantSelected]);

  useEffect(() => {
    const channel = supabase
      .channel("assistants")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "assistants",
        },
        (payload: any) => {
          setAssistantsList([...assistantsList, payload.new]);
          setAssistantSelected(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assistantsList]);

  useEffect(() => {
    const channel = supabase
      .channel("assistants_delete")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "assistants",
        },
        (payload: any) => {
          setAssistantsList(
            assistantsList.filter(
              (assistant) => assistant.id !== payload.old.id
            )
          );
          setAssistantSelected(assistantsList[0]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assistantsList]);

  if (loading) {
    return (
      <div className='flex flex-col h-[92vh] items-center p-6'>
        <div className='flex w-full h-full gap-4'>
          <Skeleton className='flex  flex-col w-[15%]  rounded p-2'>
            <Skeleton className='flex bg-zinc-900 w-full h-[50px] my-2 flex-col'></Skeleton>
            <Skeleton className='flex bg-zinc-900 w-full h-[20px] my-2 flex-col'></Skeleton>
            <Skeleton className='flex bg-zinc-900 w-full h-[50px] my-2  flex-col'></Skeleton>
          </Skeleton>
          <Skeleton className='flex flex-col w-[85%]  rounded p-2'>
            <Skeleton className='flex bg-zinc-900 w-full h-[30px] my-2 flex-col'></Skeleton>
            <div className='flex gap-4'>
              <Skeleton className='flex bg-zinc-900 w-[50%] h-[80vh] my-2 flex-col'></Skeleton>
              <Skeleton className='flex bg-zinc-900 w-[50%] h-[80vh] my-2 flex-col'></Skeleton>
            </div>
          </Skeleton>
        </div>
      </div>
    );
  }

  return (
    <>
      {assistantsList.length > 0 ? (
        // Render assistants if there are any
        <ConfigAssistant
          templates={templates.data}
          assistantsListPage={assistantsList}
          assistantSelected={assistantSelected}
          setAssistantSelected={setAssistantSelected}
          qaList={qaList}
          setQaList={setQaList}
        />
      ) : (
        <div className='flex flex-col justify-center min-h-[90vh] items-center p-6'>
          <div className='flex w-[40%] flex-col justify-center items-center text-muted-foreground'>
            <p>Todavía no has creado un asistente.</p>
            <p>
              Haz clic en el botón de abajo para agregar un nuevo asistente.
            </p>
            <ModalAdd templates={templates.data} />
          </div>
        </div>
      )}
    </>
  );
}
