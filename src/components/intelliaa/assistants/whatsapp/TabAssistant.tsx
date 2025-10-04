"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { Assistant } from "@/interfaces/intelliaa";
import {
  activateWs,
  addDsAssistant,
  deleteDsAssistant,
  getAssistantsVoice,
  getDsAssistant,
  updateAssistant,
  updateDsAssistant,
} from "@/lib/actions/intelliaa/assistants";
import { activeWsService } from "@/lib/actions/intelliaa/railway";
import ChatWsComponent from "./Chat";
import AssistantSettings from "./AssistantSettings";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { getDocumentssByDocumentStorageId } from "@/lib/actions/intelliaa/documents";

interface QAItem {
  id: string;
  question: string;
  answer: string;
  id_document: string;
  namespace: string;
}

interface TabAssistantProps {
  assistant: Assistant;
  setAssistant: (assistant: Assistant) => void;
  qaList: QAItem[];
  setQaList: (qaList: QAItem[]) => void;
}

interface voiceAssistant {
  id: string;
  name: string;
  id_elevenlabs: string;
}

interface DocumentType {
  name: string;
  s3_key: string;
  id_document: string;
  namespace: string;
}

export default function TabAssistant({
  assistant,
  setAssistant,
  qaList,
  setQaList,
}: TabAssistantProps) {
  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];

  if (!assistant) return null;

  const [temperatureState, setTemperatureState] = useState(
    assistant?.temperature || 0
  );
  const [maxTokens, setMaxTokens] = useState(assistant.token || 0);
  const [promptState, setPromptState] = useState(assistant.prompt || "");
  const [isWhatsappActivated, setIsWhatsappActivated] = useState(false);
  const [KeywordTransfer, setKeywordTransfer] = useState(
    assistant.keyword_transfer_ws || ""
  );
  const [NumberTransfer, setNumberTransfer] = useState(
    assistant.number_transfer_ws || ""
  );
  const [isChangeOptions, setIsChangeOptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentStorage, setSelectedDocumentStorage] = useState("");
  const [bdDocs, setBdDocs] = useState(assistant?.docs_keys || []);
  const [loadingAssistant, setLoadingAssistant] = useState(false);
  const [loadingActiveWs, setLoadingActiveWs] = useState(false);
  const [errorMessageNumberTransfer, setErrorMessageNumberTransfer] =
    useState("");
  const [voiceAssistant, setVoiceAssistant] = useState<voiceAssistant[]>([]);
  const [voiceAssistantSelected, setVoiceAssistantSelected] = useState(
    assistant.voice_assistant || ""
  );

  const supabase = createClient();

  useEffect(() => {
    const getDocuments = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      const accountId = team_account.account_id;
      const data = await getDocumentssByDocumentStorageId(accountId);
    };
    const getAssistantVoice = async () => {
      const data = await getAssistantsVoice();

      if (data.length === 0) {
        return;
      }

      setVoiceAssistant(data);
    };

    getAssistantVoice();
    getDocuments();
  }, []);

  useEffect(() => {
    const fetchAssistant = async () => {
      setTemperatureState(assistant.temperature || 0);
      setMaxTokens(assistant.token || 0);
      setPromptState(assistant.prompt || "");
      setIsWhatsappActivated(assistant.activated_whatsApp);
      setLoadingActiveWs(assistant.is_deploying_ws);
      setKeywordTransfer(assistant.keyword_transfer_ws || "");
      setNumberTransfer(assistant.number_transfer_ws || "");
      setBdDocs(assistant.docs_keys || []);
      setIsChangeOptions(false);
      setLoading(false);
      setVoiceAssistantSelected(assistant.voice_assistant || "");
    };
    const fetchDsAssistant = async () => {
      const data = await getDsAssistant(assistant.id);
      setSelectedDocumentStorage(data[0]?.document_storage || "");
    };

    fetchAssistant();
    fetchDsAssistant();
  }, [assistant]);

  useEffect(() => {
    const channel = supabase
      .channel("assistant_docs_update")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "assistants",
        },
        (payload: any) => {
          setLoadingActiveWs(payload.new.is_deploying_ws);
          setIsWhatsappActivated(payload.new.activated_whatsApp);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setLoadingActiveWs, loadingActiveWs]);

  useEffect(() => {
    const channel = supabase
      .channel("qa_docs_update")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "qa_docs",
        },
        (payload: any) => {
          setQaList(
            qaList.map((doc) => (doc.id === payload.new.id ? payload.new : doc))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qaList]);

  useEffect(() => {
    const channel = supabase
      .channel("qa_docs_delete")
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "qa_docs",
        },
        (payload: any) => {
          setQaList(qaList.filter((doc) => doc.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qaList]);

  useEffect(() => {
    const channel = supabase
      .channel("qa_docs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "qa_docs",
        },
        (payload: any) => {
          setQaList([...qaList, payload.new as any]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qaList]);

  const handleActivateWhatsapp = async () => {
    setLoadingActiveWs(true);

    const data = await activeWsService(
      assistant.id,
      assistant.namespace,
      KeywordTransfer
    );

    const url = `${data?.url}/qr.png`;

    const newassistant = await activateWs(
      assistant.id,
      data?.serviceId,
      url,
      KeywordTransfer
    );

    setAssistant(newassistant);
  };

  const handleSaveAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAssistant(true);
    const team_account = await getAccountBySlug(null, accountSlug);

    const data = {
      temperature: temperatureState,
      token: maxTokens,
      prompt: promptState,
      keyword_transfer_ws: KeywordTransfer,
      number_transfer_ws: NumberTransfer,
      namespace: assistant.namespace,
      voice_assistant: voiceAssistantSelected,
    };

    const newBdDocs = await updateAssistant(
      team_account.account_id,
      assistant.id,
      data
    );

    const setDsAssistant = async () => {
      const data = await getDsAssistant(assistant.id);

      // Si no hay documentStorage seleccionado y existe un registro, lo eliminamos
      if (selectedDocumentStorage === "" && data.length > 0) {
        await deleteDsAssistant(assistant.id, data[0]?.document_storage);
        return;
      }

      // Si hay datos existentes, actualizamos
      if (data.length > 0) {
        if (data[0].document_storage !== selectedDocumentStorage) {
          await updateDsAssistant(assistant.id, selectedDocumentStorage);
        }
      } else {
        // Si no hay datos existentes y hay un documentStorage seleccionado, lo agregamos
        if (selectedDocumentStorage) {
          await addDsAssistant(assistant.id, selectedDocumentStorage);
        }
      }
    };

    setBdDocs(newBdDocs as any);
    setDsAssistant();
    setLoadingAssistant(false);
    setIsChangeOptions(false);
  };

  return (
    <div className='flex w-full gap-2 min-h-[75vh] max-h-[68vh] 2xl:min-h-[80vh] 2xl:max-h-[73vh] '>
      <AssistantSettings
        assistant={assistant}
        temperatureState={temperatureState}
        setTemperatureState={setTemperatureState}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        promptState={promptState}
        setPromptState={setPromptState}
        isWhatsappActivated={isWhatsappActivated}
        setIsWhatsappActivated={setIsWhatsappActivated}
        KeywordTransfer={KeywordTransfer}
        setKeywordTransfer={setKeywordTransfer}
        NumberTransfer={NumberTransfer}
        setNumberTransfer={setNumberTransfer}
        isChangeOptions={isChangeOptions}
        setIsChangeOptions={setIsChangeOptions}
        documents={documents}
        selectedDocumentStorage={selectedDocumentStorage}
        setSelectedDocumentStorage={setSelectedDocumentStorage}
        bdDocs={bdDocs}
        loadingAssistant={loadingAssistant}
        loadingActiveWs={loadingActiveWs}
        errorMessageNumberTransfer={errorMessageNumberTransfer}
        setErrorMessageNumberTransfer={setErrorMessageNumberTransfer}
        handleActivateWhatsapp={handleActivateWhatsapp}
        handleSaveAssistant={handleSaveAssistant}
        voiceAssistantSelected={voiceAssistantSelected}
        setVoiceAssistantSelected={setVoiceAssistantSelected}
        voiceAssistant={voiceAssistant}
        setVoiceAssistant={setVoiceAssistant}
        accountSlug={accountSlug}
      />
      <ChatWsComponent
        assistant={assistant}
        selectedDocumentStorage={selectedDocumentStorage}
      />
    </div>
  );
}
