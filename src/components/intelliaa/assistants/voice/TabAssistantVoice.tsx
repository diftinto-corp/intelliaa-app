"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { Assistant } from "@/interfaces/intelliaa";
import {
  deleteDocuments,
  getAllPdf_Doc,
} from "@/lib/actions/intelliaa/documents";
import {
  activateWs,
  updateAssistant,
  getAssistantsVoice,
} from "@/lib/actions/intelliaa/assistants";
import { activeWsService } from "@/lib/actions/intelliaa/railway";
import AssistantSettings from "./AssistantSettings";
import QuestionsAndAnswers from "./AdvancedComponent";
import { deleteQa } from "@/lib/actions/intelliaa/qa";
import AdvancedComponent from "./AdvancedComponent";
import { updateAssistantVoiceVapi } from "@/lib/actions/intelliaa/assistantVoice";
import { set } from "date-fns";

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

export default function TabAssistant({
  assistant,
  setAssistant,
}: TabAssistantProps) {
  if (!assistant) return null;

  const [temperatureState, setTemperatureState] = useState(
    assistant?.temperature || 0
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    assistant?.welcome_assistant || "Hola, ¿En que te puedo ayudar?"
  );
  const [endCallPhrases, setEndCallPhrases] = useState(
    assistant?.endCallPhrases || [
      "hasta luego",
      "adios",
      "chao",
      "bye",
      "bye bye",
      "hasta pronto",
    ]
  );

  const [voicemailMessage, setVoicemailMessage] = useState(
    assistant?.voicemailMessage || ""
  );

  const [endCallMessage, setEndCallMessage] = useState(
    assistant?.endCallMessage ||
      "Hasta luego, gracias por usar nuestro servicio"
  );

  console.log(endCallMessage);
  const [detectEmotion, setDetectEmotion] = useState<boolean>(
    assistant?.detect_emotion || false
  );
  const [backgroundOffice, setBackgroundOffice] = useState<boolean>(
    assistant?.background_office || false
  );
  const [welcomeMessageAssistant, setWelcomeMessageAssistant] = useState(
    assistant?.welcome_assistant || ""
  );
  const [voiceAssistant, setVoiceAssistant] = useState<voiceAssistant[]>([]);

  const [recordCall, setRecordCall] = useState<boolean>(
    assistant?.record_call || false
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
  const [documents, setDocuments] = useState<
    { name: string; id_vapi_doc: string }[]
  >([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(
    assistant?.documents_vapi || []
  );
  const [bdDocs, setBdDocs] = useState(assistant?.docs_keys || []);
  const [loadingAssistant, setLoadingAssistant] = useState(false);
  const [loadingActiveWs, setLoadingActiveWs] = useState(false);
  const [errorMessageNumberTransfer, setErrorMessageNumberTransfer] =
    useState("");
  const [voiceAssistantSelected, setVoiceAssistantSelected] = useState(
    assistant.voice_assistant || ""
  );

  const supabase = createClient();

  useEffect(() => {
    const getDocuments = async () => {
      const account = await getAccount();
      const account_id = account.account_id;
      const data: any = await getAllPdf_Doc(account_id);
      setSelectedDocuments(bdDocs);

      if (data.length > 0) {
        const newDocuments = data.map((doc: any) => ({
          name: doc.name,
          id_vapi_doc: doc.id_vapi_doc,
        }));
        setDocuments(newDocuments);
      }
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
      const account = await getAccount();
      const account_id = account.account_id;

      setTemperatureState(assistant.temperature || 0);
      setMaxTokens(assistant.token || 0);
      setPromptState(assistant.prompt || "");
      setWelcomeMessage(
        assistant.welcome_assistant || "Hola, ¿En que te puedo ayudar?"
      );
      setDetectEmotion(assistant.detect_emotion || false);
      setBackgroundOffice(assistant.background_office || true);
      setRecordCall(assistant.record_call || false);
      setSelectedDocuments(assistant.documents_vapi || []);
      setBdDocs(assistant.docs_keys || []);
      setIsChangeOptions(false);
      setLoading(false);
      setVoiceAssistantSelected(assistant.voice_assistant || "");
      setEndCallMessage(
        assistant.endCallMessage ||
          "Hasta luego, gracias por usar nuestro servicio"
      );
      setVoicemailMessage(assistant.voicemailMessage || "");
      setEndCallPhrases(
        assistant.endCallPhrases || [
          "hasta luego",
          "adios",
          "chao",
          "bye",
          "bye bye",
          "hasta pronto",
        ]
      );
    };

    fetchAssistant();
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

  const handleTestAssistantVoice = async () => {};

  const handleSaveAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAssistant(true);
    const account = await getAccount();
    const account_id = account.account_id;

    console.log(endCallMessage);

    try {
      const res = await fetch("/api/update-assistant-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_assistant: assistant?.id,
          prompt: promptState,
          welcomeMessage: welcomeMessage,
          temperature: temperatureState,
          maxTokens: maxTokens,
          voiceId: voiceAssistantSelected,
          recordCall: recordCall,
          backgroundOffice: backgroundOffice,
          detectEmotion: detectEmotion,
          id_assistant_vapi: assistant?.voice_assistant_id,
          fileIds: selectedDocuments,
          endCallPhrases: endCallPhrases,
          endCallMessage: endCallMessage,
          voicemailMessage: voicemailMessage,
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
      setLoadingAssistant(false);
      setIsChangeOptions(false);
    }

    // const newAssistantVoice = await updateAssistantVoiceVapi(
    //   assistant?.id,
    //   promptState,
    //   welcomeMessage,
    //   temperatureState,
    //   maxTokens,
    //   voiceAssistant[0].id,
    //   recordCall,
    //   backgroundOffice,
    //   detectEmotion
    // );
  };

  return (
    <Tabs defaultValue='settings' className='w-full '>
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger
          className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
          value='settings'>
          Configuración
        </TabsTrigger>
        <TabsTrigger
          className='data-[state=active]:bg-[#182426] data-[state=active]:text-primary'
          value='advanced'>
          Incrustar asistente en tu web
        </TabsTrigger>
      </TabsList>
      <TabsContent value='settings'>
        <div className='flex w-full gap-2 min-h-[68vh] max-h-[68vh] 2xl:min-h-[73vh] 2xl:max-h-[73vh] '>
          <AssistantSettings
            assistant={assistant}
            temperatureState={temperatureState}
            setTemperatureState={setTemperatureState}
            maxTokens={maxTokens}
            setMaxTokens={setMaxTokens}
            promptState={promptState}
            setPromptState={setPromptState}
            welcomeMessage={welcomeMessage}
            setWelcomeMessage={setWelcomeMessage}
            setDetectEmotion={setDetectEmotion}
            backgroundOffice={backgroundOffice}
            setBackgroundOffice={setBackgroundOffice}
            welcomeMessageAssistant={welcomeMessageAssistant}
            setWelcomeMessageAssistant={setWelcomeMessageAssistant}
            setRecordCall={setRecordCall}
            recordCall={recordCall}
            detectEmotion={detectEmotion}
            voiceAssistant={voiceAssistant}
            setVoiceAssistant={setVoiceAssistant}
            handleTestAssistantVoice={handleTestAssistantVoice}
            isChangeOptions={isChangeOptions}
            setIsChangeOptions={setIsChangeOptions}
            documents={documents}
            selectedDocuments={selectedDocuments}
            setSelectedDocuments={setSelectedDocuments}
            bdDocs={bdDocs}
            loadingAssistant={loadingAssistant}
            loadingActiveWs={loadingActiveWs}
            handleSaveAssistant={handleSaveAssistant}
            voiceAssistantSelected={voiceAssistantSelected}
            setVoiceAssistantSelected={setVoiceAssistantSelected}
            endCallMessage={endCallMessage}
            setEndCallMessage={setEndCallMessage}
            voicemailMessage={voicemailMessage}
            setVoicemailMessage={setVoicemailMessage}
            endCallPhrases={endCallPhrases}
            setEndCallPhrases={setEndCallPhrases}
          />
        </div>
      </TabsContent>
      <AdvancedComponent assistant={assistant} />
    </Tabs>
  );
}
