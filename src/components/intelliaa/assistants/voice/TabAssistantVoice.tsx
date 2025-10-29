"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { getAccount } from "@/lib/actions/intelliaa/accounts";
import { Assistant } from "@/interfaces/intelliaa";
import {} from "@/lib/actions/intelliaa/documents";
import {
  activateWs,
  updateAssistant,
  getAssistantsVoice,
  getDsAssistant,
  addDsAssistant,
  deleteDsAssistant,
  updateDsAssistant,
} from "@/lib/actions/intelliaa/assistants";
import { activeWsService } from "@/lib/actions/intelliaa/railway";
import AssistantSettings from "./AssistantSettings";
import QuestionsAndAnswers from "./AdvancedComponent";
import { deleteQa } from "@/lib/actions/intelliaa/qa";
import AdvancedComponent from "./AdvancedComponent";
import { updateAssistantVoiceVapi } from "@/lib/actions/intelliaa/assistantVoice";
import { set } from "date-fns";
import { usePathname } from "next/navigation";
import { getAccountBySlug } from "@/lib/actions/accounts";
import { AssignStorageSection } from "@/components/assistants/AssignStorageSection";
import { useToast } from "@/components/ui/use-toast";
import {
  UnsavedChangesDialog,
  useBrowserNavigationGuard
} from "../common/UnsavedChangesDialog";
import { VoiceAssistantFormSkeleton } from "../common/FormSkeletons";

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

  const pathname = usePathname();
  const accountSlug = pathname.split("/")[1];
  const { toast } = useToast();

  // Unsaved changes dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Browser navigation guard (prevents accidental close/reload)
  useBrowserNavigationGuard(isChangeOptions);

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
  const [documentStorageId, setDocumentStorageId] = useState("");
  const [bdDocs, setBdDocs] = useState(assistant?.docs_keys || []);
  const [loadingAssistant, setLoadingAssistant] = useState(false);
  const [loadingActiveWs, setLoadingActiveWs] = useState(false);
  const [errorMessageNumberTransfer, setErrorMessageNumberTransfer] =
    useState("");
  const [voiceAssistantSelected, setVoiceAssistantSelected] = useState(
    assistant.voice_assistant || ""
  );
  const [account_id, setAccountId] = useState("");

  const supabase = createClient();

  useEffect(() => {
    const getAccountId = async () => {
      const team_account = await getAccountBySlug(null, accountSlug);
      setAccountId(team_account.account_id);
    };

    const getAssistantVoice = async () => {
      const data = await getAssistantsVoice();

      if (data.length === 0) {
        return;
      }

      setVoiceAssistant(data);
    };

    getAssistantVoice();
    getAccountId();
  }, []);

  useEffect(() => {
    const fetchAssistant = async () => {
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
      const fetchDsAssistant = async () => {
        const data = await getDsAssistant(assistant.id);
        setDocumentStorageId(data[0]?.document_storage || "");
      };

      fetchDsAssistant();
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
          documentStorageId: documentStorageId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.message || errorData?.error || "Error al guardar cambios";

        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log("Assistant updated successfully:", data);

      // Update document storage assignment
      const dsData = await getDsAssistant(assistant.id);

      // Si no hay documentStorage seleccionado y existe un registro, lo eliminamos
      if (documentStorageId === "" && dsData.length > 0) {
        await deleteDsAssistant(assistant.id, dsData[0]?.document_storage);
      }
      // Si hay datos existentes, actualizamos
      else if (dsData.length > 0) {
        if (dsData[0].document_storage !== documentStorageId) {
          await updateDsAssistant(assistant.id, documentStorageId);
        }
      }
      // Si no hay datos existentes y hay un documentStorage seleccionado, lo agregamos
      else if (documentStorageId) {
        await addDsAssistant(assistant.id, documentStorageId);
      }

      // Success toast
      toast({
        title: "Cambios guardados",
        description: "La configuración del asistente se actualizó correctamente.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error saving assistant voice:", error);

      // Error toast with details
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error instanceof Error
          ? error.message
          : "No se pudieron guardar los cambios. Por favor, inténtalo de nuevo.",
        duration: 5000,
      });
    } finally {
      setLoadingAssistant(false);
      setIsChangeOptions(false);
    }
  };

  return (
    <>
      <Tabs defaultValue='settings' className='w-full '>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger
            className='data-[state=active]:bg-green-100 data-[state=active]:text-primary dark:data-[state=active]:bg-[#182426] dark:data-[state=active]:text-primary'
            value='settings'>
            Configuración
          </TabsTrigger>
          <TabsTrigger
            className='data-[state=active]:bg-green-100 data-[state=active]:text-primary dark:data-[state=active]:bg-[#182426] dark:data-[state=active]:text-primary'
            value='storages'>
            Almacenamientos
          </TabsTrigger>
          <TabsTrigger
            className='data-[state=active]:bg-green-100 data-[state=active]:text-primary dark:data-[state=active]:bg-[#182426] dark:data-[state=active]:text-primary'
            value='advanced'>
            Incrustar asistente en tu web
          </TabsTrigger>
        </TabsList>
        <TabsContent value='settings'>
          <div className='flex w-full gap-2 min-h-[68vh] max-h-[68vh] 2xl:min-h-[74vh] 2xl:max-h-[73vh] '>
            {loading ? (
              <VoiceAssistantFormSkeleton />
            ) : (
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
                documentStorageId={documentStorageId}
                setDocumentStorageId={setDocumentStorageId}
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value='storages'>
          <div className='p-6'>
            <AssignStorageSection
              assistantId={assistant.id}
              accountId={account_id}
              accountSlug={accountSlug}
            />
          </div>
        </TabsContent>
        <AdvancedComponent assistant={assistant} />
      </Tabs>

      {/* Unsaved changes dialog */}
      <UnsavedChangesDialog
        hasUnsavedChanges={isChangeOptions}
        isOpen={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        onDiscard={() => {
          setShowUnsavedDialog(false);
          if (pendingNavigation) {
            pendingNavigation();
            setPendingNavigation(null);
          }
        }}
      />
    </>
  );
}
